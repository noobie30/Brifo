import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  AutoCaptureState,
  PermissionError,
  getAutoCaptureState,
  startAutoCapture,
  stopAutoCapture,
  subscribeAutoCapture,
} from "../lib/auto-capture";
import { generateNotes, getMeeting, getTranscript } from "../lib/api";
import { useAppStore } from "../store/app-store";
import { TranscriptSegmentRecord } from "../types";
import { Button } from "../components/ui";
import { PermissionErrorBanner } from "../components/PermissionErrorBanner";

const QUICK_NOTE_DRAFT_KEY = "brifo_quick_note_draft_v1";

function formatQuickNoteTitle() {
  const now = new Date();
  return `Quick Note ${now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

export function QuickNotePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = useMemo(
    () => new URLSearchParams(location.search),
    [location.search],
  );
  const [draft, setDraft] = useState(
    () => localStorage.getItem(QUICK_NOTE_DRAFT_KEY) ?? "",
  );
  const [noteTitle, setNoteTitle] = useState("New note");
  const [captureState, setCaptureState] = useState<AutoCaptureState | null>(
    getAutoCaptureState(),
  );
  const [error, setError] = useState<string | null>(null);
  const [isPermissionError, setIsPermissionError] = useState(false);
  const [finalizePhase, setFinalizePhase] = useState<
    "idle" | "transcribing" | "generating"
  >("idle");
  const [statusText, setStatusText] = useState<string | null>(null);
  const loadDashboard = useAppStore((state) => state.loadDashboard);
  const meetingIdRef = useRef<string>("");
  const autoStartAttemptedRef = useRef(false);
  if (!meetingIdRef.current) {
    const signal = queryParams.get("signal")?.trim();
    meetingIdRef.current = signal
      ? `detected:${signal}`
      : `quick-note:${Date.now()}`;
  }
  const quickNoteMeetingId = meetingIdRef.current;
  const resolvedQuickNoteTitle = noteTitle.trim() || formatQuickNoteTitle();
  const autoStartEnabled = queryParams.get("autoStart") !== "0";
  const sourceApp = queryParams.get("source")?.trim() || "Brifo Quick Note";
  const linkedMeetingId = queryParams.get("meetingId")?.trim();
  const signalKey = queryParams.get("signal")?.trim();
  const autoGenerateQuery = queryParams.get("autoGenerate");
  const shouldAutoGenerateAfterStop =
    autoGenerateQuery === "1" || Boolean(signalKey) || Boolean(linkedMeetingId);

  useEffect(() => {
    localStorage.setItem(QUICK_NOTE_DRAFT_KEY, draft);
  }, [draft]);

  useEffect(() => subscribeAutoCapture(setCaptureState), []);

  useEffect(() => {
    if (!autoStartEnabled || autoStartAttemptedRef.current) {
      return;
    }
    autoStartAttemptedRef.current = true;

    if (getAutoCaptureState()) {
      return;
    }

    void startAutoCapture({
      meetingId: quickNoteMeetingId,
      title: resolvedQuickNoteTitle,
      trigger: "join",
      sourceApp,
    }).catch((captureError) => {
      setIsPermissionError(captureError instanceof PermissionError);
      setError(
        captureError instanceof Error
          ? captureError.message
          : "Unable to start listening session.",
      );
    });
  }, [autoStartEnabled, quickNoteMeetingId, resolvedQuickNoteTitle, sourceApp]);

  async function onToggleCapture() {
    try {
      if (captureState) {
        setStatusText(null);
        setFinalizePhase("transcribing");
        await stopAutoCapture("manual");
        await finalizeTranscriptAndNotes(shouldAutoGenerateAfterStop);
        return;
      }

      if (finalizePhase !== "idle") {
        return;
      }

      await startAutoCapture({
        meetingId: quickNoteMeetingId,
        title: resolvedQuickNoteTitle,
        trigger: "join",
        sourceApp,
      });
      setStatusText(null);
      setError(null);
      setIsPermissionError(false);
    } catch (captureError) {
      setIsPermissionError(captureError instanceof PermissionError);
      setError(
        captureError instanceof Error
          ? captureError.message
          : "Unable to update listening state.",
      );
      setFinalizePhase("idle");
    }
  }

  async function finalizeTranscriptAndNotes(autoGenerate: boolean) {
    try {
      const transcript = await waitForTranscriptStability(quickNoteMeetingId);
      if (!transcript.length) {
        throw new Error(
          "No transcript captured yet. Keep listening for a bit longer, then stop again.",
        );
      }

      // Fetch speaker map to resolve generic labels to real names
      let speakerMap: Record<string, string> | undefined;
      try {
        const meetingData = await getMeeting(quickNoteMeetingId);
        speakerMap =
          meetingData?.speakerMap &&
          Object.keys(meetingData.speakerMap).length > 0
            ? meetingData.speakerMap
            : undefined;
      } catch {
        // Meeting may not exist yet or speakerMap not resolved — continue with raw labels
      }

      const transcriptText = transcript
        .map((segment) => {
          const rawLabel = segment.speakerLabel?.trim() || "Speaker";
          const speaker = speakerMap?.[rawLabel] ?? rawLabel;
          return `${speaker}: ${segment.text}`;
        })
        .join("\n");
      const normalizedTranscript = transcriptText.trim();
      const normalizedDraft = draft.trim();
      const mergedNotes =
        normalizedDraft &&
        normalizedTranscript &&
        !normalizedDraft.includes(normalizedTranscript)
          ? `${normalizedDraft}\n\n${normalizedTranscript}`
          : normalizedDraft || normalizedTranscript;

      if (mergedNotes) {
        setDraft(mergedNotes);
      }

      setFinalizePhase("idle");
      if (autoGenerate) {
        setFinalizePhase("generating");
        const generated = await generateNotes(quickNoteMeetingId, {
          meetingTitle: resolvedQuickNoteTitle,
          rawUserNotes: mergedNotes || undefined,
          templateUsed: "general",
        });
        await loadDashboard();
        setFinalizePhase("idle");
        setStatusText(
          generated.actionItems.length > 0
            ? "Transcript added. Document and Jira tickets generated."
            : "Transcript added. Document generated.",
        );
      } else {
        setStatusText("Transcript added to notes.");
      }
      setError(null);
    } catch (finalizeError) {
      setFinalizePhase("idle");
      setStatusText(null);
      setError(
        finalizeError instanceof Error
          ? finalizeError.message
          : "Stopped capture, but could not finish transcript and note generation.",
      );
    }
  }

  async function onGenerateDocumentAndTasks() {
    try {
      if (finalizePhase !== "idle") {
        return;
      }

      const normalizedDraft = draft.trim();
      if (!normalizedDraft) {
        setError("Add some notes first, then generate document and tasks.");
        return;
      }

      setStatusText(null);
      setError(null);
      setFinalizePhase("generating");
      const generated = await generateNotes(quickNoteMeetingId, {
        meetingTitle: resolvedQuickNoteTitle,
        rawUserNotes: normalizedDraft,
        templateUsed: "general",
      });
      await loadDashboard();
      setFinalizePhase("idle");
      setStatusText(
        generated.actionItems.length > 0
          ? "Document and Jira tickets generated."
          : "Document generated.",
      );
    } catch (generationError) {
      setFinalizePhase("idle");
      setStatusText(null);
      setError(
        generationError instanceof Error
          ? generationError.message
          : "Could not generate document and tasks.",
      );
    }
  }

  async function onDeleteNote() {
    try {
      if (captureState && finalizePhase === "idle") {
        setFinalizePhase("transcribing");
        await stopAutoCapture("manual");
      }
    } catch {
      // Ignore stop failure here and allow local draft clear.
    } finally {
      setFinalizePhase("idle");
      setDraft("");
      setNoteTitle("New note");
      setStatusText("Note cleared.");
      setError(null);
      localStorage.removeItem(QUICK_NOTE_DRAFT_KEY);
    }
  }

  const captureLabel =
    finalizePhase === "generating"
      ? "Creating notes..."
      : finalizePhase === "transcribing" || captureState?.status === "stopping"
        ? "Transcribing..."
        : captureState
          ? "Listening..."
          : "Start listening";

  const captureIcon =
    finalizePhase === "generating"
      ? "auto_awesome"
      : finalizePhase === "transcribing" || captureState?.status === "stopping"
        ? "hourglass_top"
        : captureState
          ? "stop"
          : "mic";

  const captureBtnClass =
    finalizePhase === "generating" ||
    finalizePhase === "transcribing" ||
    captureState?.status === "stopping"
      ? "bg-warning-500 hover:bg-warning-600 text-white"
      : captureState
        ? "bg-accent-600 hover:bg-accent-700 text-white animate-pulse"
        : "bg-gray-100 hover:bg-gray-200 text-gray-700";

  return (
    <section className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex items-center px-4 py-3 border-b border-gray-200">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/home")}
          aria-label="Back to dashboard"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </Button>
      </div>

      {/* Editor shell */}
      <article className="flex flex-col flex-1 min-h-0 px-6 py-4">
        <div className="flex items-center justify-between gap-4 mb-4">
          <input
            className="flex-1 border-none text-xl font-semibold bg-transparent placeholder:text-gray-400 focus:outline-none"
            value={noteTitle}
            onChange={(event) => setNoteTitle(event.target.value)}
            placeholder="New note"
            aria-label="Note title"
          />
          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={() => void onGenerateDocumentAndTasks()}
              disabled={finalizePhase !== "idle"}
            >
              <span className="material-symbols-outlined text-base">
                description
              </span>
              Generate document &amp; tasks
            </Button>
            <Button
              variant="dangerOutline"
              size="sm"
              onClick={() => void onDeleteNote()}
              disabled={finalizePhase !== "idle"}
            >
              <span className="material-symbols-outlined text-base">
                delete
              </span>
              Delete
            </Button>
          </div>
        </div>

        <textarea
          className="flex-1 resize-none border-none focus:outline-none text-sm text-gray-800 leading-relaxed placeholder:text-gray-400 bg-transparent"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Write notes..."
          rows={16}
        />
      </article>

      {/* Footer */}
      <footer className="border-t border-gray-200 px-6 py-3 bg-gray-50">
        <p className="text-xs text-gray-400 mb-2">
          Always get consent when transcribing others
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={`inline-flex items-center gap-1.5 px-3 h-8 rounded-md text-sm font-medium transition-colors duration-150 disabled:opacity-50 disabled:pointer-events-none ${captureBtnClass}`}
            onClick={() => void onToggleCapture()}
            disabled={finalizePhase !== "idle"}
          >
            <span className="material-symbols-outlined text-base">
              {captureIcon}
            </span>
            {captureLabel}
          </button>
          <input
            className="flex-1 h-8 px-3 text-sm border border-gray-200 rounded-md bg-white text-gray-400 focus:outline-none cursor-default"
            readOnly
            value="Ask anything"
          />
          <Button variant="ghost" size="sm">
            <span className="material-symbols-outlined text-base">
              auto_awesome
            </span>
            Suggest topics
          </Button>
        </div>
        {statusText ? (
          <p className="mt-2 text-xs text-success-600">{statusText}</p>
        ) : null}
      </footer>

      {/* Error display */}
      {error && isPermissionError ? (
        <div className="mx-6 mb-3">
          <PermissionErrorBanner
            error={error}
            onRetry={() => {
              setError(null);
              setIsPermissionError(false);
              void startAutoCapture({
                meetingId: quickNoteMeetingId,
                title: resolvedQuickNoteTitle,
                trigger: "join",
                sourceApp,
              }).catch((captureError) => {
                setIsPermissionError(captureError instanceof PermissionError);
                setError(
                  captureError instanceof Error
                    ? captureError.message
                    : "Unable to start listening session.",
                );
              });
            }}
            onDismiss={() => {
              setError(null);
              setIsPermissionError(false);
            }}
          />
        </div>
      ) : error ? (
        <div className="mx-6 mb-3 px-3 py-2 rounded-md bg-error-50 text-error-700 text-sm">
          {error}
        </div>
      ) : null}
    </section>
  );
}

async function waitForTranscriptStability(
  meetingId: string,
): Promise<TranscriptSegmentRecord[]> {
  const maxAttempts = 80;
  const waitMs = 3000;

  let lastCount = -1;
  let stableTicks = 0;
  let lastTranscript: TranscriptSegmentRecord[] = [];

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    let segments: TranscriptSegmentRecord[] = [];
    try {
      segments = await getTranscript(meetingId);
    } catch {
      segments = [];
    }
    const count = segments.length;
    if (count > 0) {
      lastTranscript = segments;
    }

    if (count > 0) {
      if (count === lastCount) {
        stableTicks += 1;
      } else {
        stableTicks = 0;
      }

      if (stableTicks >= 2) {
        return segments;
      }
    }

    lastCount = count;
    await new Promise((resolve) => window.setTimeout(resolve, waitMs));
  }

  return lastTranscript;
}
