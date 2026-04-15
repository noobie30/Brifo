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
import { generateNotes, getMeeting } from "../lib/api";
import {
  claimFinalization,
  releaseFinalization,
  waitForTranscriptStability,
} from "../lib/finalize-capture";
import { useAppStore } from "../store/app-store";
import { Button, Dialog } from "../components/ui";
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
  const [noteTitle, setNoteTitle] = useState("Quick Note");
  const [captureState, setCaptureState] = useState<AutoCaptureState | null>(
    getAutoCaptureState(),
  );
  const [error, setError] = useState<string | null>(null);
  const [isPermissionError, setIsPermissionError] = useState(false);
  const [finalizePhase, setFinalizePhase] = useState<
    "idle" | "transcribing" | "generating"
  >("idle");
  const [statusText, setStatusText] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const loadDashboard = useAppStore((state) => state.loadDashboard);
  const meetingIdRef = useRef<string>("");
  const autoStartAttemptedRef = useRef(false);
  if (!meetingIdRef.current) {
    const signal = queryParams.get("signal")?.trim();
    meetingIdRef.current = signal
      ? `detected:${signal}`
      : `quick-note:${crypto.randomUUID()}`;
  }
  const quickNoteMeetingId = meetingIdRef.current;
  const resolvedQuickNoteTitle = noteTitle.trim() || formatQuickNoteTitle();
  const autoStartEnabled = queryParams.get("autoStart") === "1";
  const sourceApp = queryParams.get("source")?.trim() || "Brifo Quick Note";
  const linkedMeetingId = queryParams.get("meetingId")?.trim();
  const signalKey = queryParams.get("signal")?.trim();
  const shouldAutoGenerateAfterStop = true;

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
    })
      .then((state) => {
        if (state?.meetingId && state.meetingId !== meetingIdRef.current) {
          meetingIdRef.current = state.meetingId;
        }
      })
      .catch((captureError) => {
        setIsPermissionError(captureError instanceof PermissionError);
        setError(
          captureError instanceof Error
            ? captureError.message
            : "Unable to start capturing session.",
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

      const state = await startAutoCapture({
        meetingId: quickNoteMeetingId,
        title: resolvedQuickNoteTitle,
        trigger: "join",
        sourceApp,
      });
      // Server may assign a different meetingId — sync it
      if (state?.meetingId && state.meetingId !== meetingIdRef.current) {
        meetingIdRef.current = state.meetingId;
      }
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
    // Claim this meetingId so BackgroundFinalizer skips it
    if (!claimFinalization(quickNoteMeetingId)) {
      return;
    }

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
    } finally {
      releaseFinalization(quickNoteMeetingId);
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
      setNoteTitle("Quick Note");
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
          ? "Capturing..."
          : "Start";

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
        ? "bg-slate-900 hover:bg-slate-800 text-white"
        : "bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300";

  return (
    <section className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex items-center px-6 py-2.5 border-b border-gray-100">
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
      <article className="flex flex-col flex-1 min-h-0 px-8 py-5 max-w-3xl mx-auto w-full">
        <div className="flex items-center justify-between gap-4 mb-4">
          <input
            className="flex-1 border-none text-lg font-semibold bg-transparent placeholder:text-gray-300 focus:outline-none tracking-tight"
            value={noteTitle}
            onChange={(event) => setNoteTitle(event.target.value)}
            placeholder="Quick Note"
            aria-label="Note title"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              className={`inline-flex items-center gap-1.5 px-3 h-8 rounded text-sm font-medium transition-all duration-150 shadow-sm hover:shadow-md disabled:opacity-50 disabled:pointer-events-none ${captureBtnClass}`}
              onClick={() => void onToggleCapture()}
              disabled={finalizePhase !== "idle"}
            >
              <span className="material-symbols-outlined text-base">
                {captureIcon}
              </span>
              {captureLabel}
            </button>
            <Button
              variant="dangerOutline"
              size="sm"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={finalizePhase !== "idle"}
            >
              <span className="material-symbols-outlined text-base">
                delete
              </span>
              Delete
            </Button>
          </div>
        </div>

        <div className="relative flex-1 min-h-0">
          <textarea
            className="h-full w-full resize-none border-none focus:outline-none text-base text-gray-800 leading-relaxed placeholder:text-gray-300 bg-transparent"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Write notes..."
            rows={16}
          />
          {finalizePhase !== "idle" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/90 backdrop-blur-sm rounded-lg">
              <svg
                className="animate-spin h-6 w-6 text-accent-500"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              <p className="text-sm text-gray-500">
                {finalizePhase === "transcribing"
                  ? "Processing transcript..."
                  : "Generating document & tasks..."}
              </p>
            </div>
          )}
        </div>
      </article>

      {/* Status text */}
      {statusText ? (
        <div className="px-8 py-2 bg-gray-50/50 border-t border-gray-100">
          <p className="text-xs text-success-600">{statusText}</p>
        </div>
      ) : null}

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
                    : "Unable to start capturing session.",
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

      <Dialog
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="Delete note?"
        description="This will stop any active capture and clear your notes. This action cannot be undone."
      >
        <div className="flex justify-end gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowDeleteConfirm(false)}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={() => {
              setShowDeleteConfirm(false);
              void onDeleteNote();
            }}
          >
            Delete
          </Button>
        </div>
      </Dialog>
    </section>
  );
}
