import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  AutoCaptureState,
  PermissionError,
  StreamStats,
  getAutoCaptureState,
  getStreamStats,
  startAutoCapture,
  stopAutoCapture,
  subscribeAutoCapture,
  subscribeStreamStats,
} from "../lib/auto-capture";
import { generateNotes, getMeeting } from "../lib/api";
import {
  claimFinalization,
  releaseFinalization,
  waitForTranscriptStability,
} from "../lib/finalize-capture";
import { useAppStore } from "../store/app-store";
import { Dialog } from "../components/ui";
import { PermissionErrorBanner } from "../components/PermissionErrorBanner";
import { DButton } from "../components/design";
import {
  IconArrowLeft,
  IconCheckCircle,
  IconClock,
  IconMic,
  IconSparkles,
  IconStop,
  IconTrash,
} from "../components/icons";

const QUICK_NOTE_DRAFT_KEY = "brifo_quick_note_draft_v1";
const LOADING_MESSAGE_ROTATE_MS = 2500;

const TRANSCRIBING_MESSAGES = [
  "Processing transcript…",
  "Untangling the audio…",
  "Lining up the words…",
  "Catching the last few syllables…",
  "Tidying up speakers…",
];

const GENERATING_MESSAGES = [
  "Generating document & tasks…",
  "Pulling out the key points…",
  "Drafting the summary…",
  "Finding action items…",
  "Connecting the dots…",
  "Polishing the wording…",
  "Almost there…",
];

function formatQuickNoteTitle() {
  const now = new Date();
  return `Quick Note ${now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatStreamHealth(
  stats: StreamStats,
  capture: AutoCaptureState,
): string {
  const sourceLabel =
    capture.systemAudioStatus === "active" ? "mic + system" : "mic only";
  if (stats.consecutiveReconnects > 0) {
    return `${sourceLabel} — reconnecting (${stats.consecutiveReconnects})`;
  }
  if (stats.consecutiveFailures > 3) {
    return `${sourceLabel} — stream errors (${stats.consecutiveFailures})`;
  }
  if (stats.bytesStreamed === 0) {
    return `${sourceLabel} — connecting…`;
  }
  return `${sourceLabel} — ${formatBytes(stats.bytesStreamed)} sent`;
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
  const [streamStats, setStreamStats] = useState<StreamStats>(
    () => getStreamStats(),
  );
  const [error, setError] = useState<string | null>(null);
  const [isPermissionError, setIsPermissionError] = useState(false);
  const [finalizePhase, setFinalizePhase] = useState<
    "idle" | "transcribing" | "generating"
  >("idle");
  const [statusText, setStatusText] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
  const loadDashboard = useAppStore((state) => state.loadDashboard);
  const meetingIdRef = useRef<string>("");
  const autoStartAttemptedRef = useRef(false);
  const signalKey = queryParams.get("signal")?.trim();
  const [quickNoteMeetingId, setQuickNoteMeetingId] = useState<string>(() => {
    const initial = signalKey
      ? `detected:${signalKey}`
      : `quick-note:${crypto.randomUUID()}`;
    meetingIdRef.current = initial;
    return initial;
  });
  const resolvedQuickNoteTitle = noteTitle.trim() || formatQuickNoteTitle();
  const autoStartEnabled = queryParams.get("autoStart") === "1";
  const sourceApp = queryParams.get("source")?.trim() || "Brifo Quick Note";
  const linkedMeetingId = queryParams.get("meetingId")?.trim();
  const shouldAutoGenerateAfterStop = true;

  useEffect(() => {
    localStorage.setItem(QUICK_NOTE_DRAFT_KEY, draft);
  }, [draft]);

  useEffect(() => subscribeAutoCapture(setCaptureState), []);
  useEffect(() => subscribeStreamStats(setStreamStats), []);

  useEffect(() => {
    if (finalizePhase === "idle") {
      setLoadingMessageIndex(0);
      return;
    }
    const interval = window.setInterval(() => {
      setLoadingMessageIndex((prev) => prev + 1);
    }, LOADING_MESSAGE_ROTATE_MS);
    return () => window.clearInterval(interval);
  }, [finalizePhase]);

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
          setQuickNoteMeetingId(state.meetingId);
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
        // Snapshot the server-assigned meetingId BEFORE any async work. The
        // ref is updated synchronously in startAutoCapture's .then(), while
        // `quickNoteMeetingId` state may still be the placeholder until
        // React re-renders.
        const currentMeetingId = meetingIdRef.current || quickNoteMeetingId;
        setStatusText(null);
        setFinalizePhase("transcribing");

        // Pre-claim finalization BEFORE stopAutoCapture fires its stop
        // listeners synchronously. Without this, BackgroundFinalizer (also
        // subscribed to the stop event) can win the claim and leave Quick
        // Note's UI stuck on "Transcribing…" forever.
        const claimed = claimFinalization(currentMeetingId);

        try {
          await stopAutoCapture("manual");
          if (!claimed) {
            // BackgroundFinalizer is already handling this capture — just
            // clear the Quick Note overlay so the UI doesn't look stuck.
            setFinalizePhase("idle");
            return;
          }
          await runFinalize(currentMeetingId, shouldAutoGenerateAfterStop);
        } finally {
          if (claimed) releaseFinalization(currentMeetingId);
        }
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
        setQuickNoteMeetingId(state.meetingId);
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

  // Runs the transcript-stability poll + optional notes generation. The
  // finalization claim is held by the caller — do not claim/release here.
  async function runFinalize(meetingId: string, autoGenerate: boolean) {
    try {
      const transcript = await waitForTranscriptStability(meetingId);
      if (!transcript.length) {
        throw new Error(
          "No transcript captured yet. Keep listening for a bit longer, then stop again.",
        );
      }

      // Fetch speaker map to resolve generic labels to real names
      let speakerMap: Record<string, string> | undefined;
      try {
        const meetingData = await getMeeting(meetingId);
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
        await generateNotes(meetingId, {
          meetingTitle: resolvedQuickNoteTitle,
          rawUserNotes: mergedNotes || undefined,
          templateUsed: "general",
        });
        await loadDashboard();
        setFinalizePhase("idle");
        setDraft("");
        localStorage.removeItem(QUICK_NOTE_DRAFT_KEY);
        setError(null);
        navigate(`/documents/${meetingId}`);
        return;
      }
      setStatusText("Transcript added to notes.");
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

  async function onDeleteNote() {
    const currentMeetingId = meetingIdRef.current || quickNoteMeetingId;
    // Pre-claim so BackgroundFinalizer doesn't try to generate notes for a
    // note the user just asked to delete.
    const claimed =
      captureState && finalizePhase === "idle"
        ? claimFinalization(currentMeetingId)
        : false;
    try {
      if (captureState && finalizePhase === "idle") {
        setFinalizePhase("transcribing");
        await stopAutoCapture("manual");
      }
    } catch {
      // Ignore stop failure here and allow local draft clear.
    } finally {
      if (claimed) releaseFinalization(currentMeetingId);
      setFinalizePhase("idle");
      setDraft("");
      setNoteTitle("Quick Note");
      setStatusText("Note cleared.");
      setError(null);
      localStorage.removeItem(QUICK_NOTE_DRAFT_KEY);
    }
  }

  const isBusy =
    finalizePhase !== "idle" || captureState?.status === "stopping";
  const captureLabel =
    finalizePhase === "generating"
      ? "Creating notes…"
      : finalizePhase === "transcribing" || captureState?.status === "stopping"
        ? "Transcribing…"
        : captureState
          ? "Stop recording"
          : "Start recording";

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div
        className="flex items-center gap-2 px-6 py-2.5"
        style={{ borderBottom: "1px solid var(--color-divider)" }}
      >
        <DButton
          variant="ghost"
          size="sm"
          onClick={() => navigate("/home")}
          aria-label="Back to dashboard"
        >
          <IconArrowLeft width={13} height={13} />
          Back
        </DButton>
        <div className="flex-1" />
        {captureState && !isBusy && (
          <span className="inline-flex items-center gap-2 text-[11.5px] text-danger">
            <span
              className="inline-block rounded-full animate-pulse"
              style={{
                width: 8,
                height: 8,
                background: "var(--color-danger)",
              }}
            />
            Recording — {formatStreamHealth(streamStats, captureState)}
          </span>
        )}
      </div>

      {/* Editor */}
      <article className="flex flex-col flex-1 min-h-0 px-10 py-7 max-w-3xl mx-auto w-full">
        <input
          className="w-full bg-transparent border-none outline-none text-[28px] font-semibold tracking-[-0.6px] text-fg placeholder:text-fg-subtle mb-2"
          value={noteTitle}
          onChange={(event) => setNoteTitle(event.target.value)}
          placeholder="Untitled note"
          aria-label="Note title"
        />
        <div className="flex items-center gap-2 mb-5 text-[11.5px] text-fg-muted mono">
          <IconClock width={11} height={11} />
          <span>
            {new Date().toLocaleDateString(undefined, {
              weekday: "long",
              month: "short",
              day: "numeric",
            })}{" "}
            · {sourceApp}
          </span>
          <div className="flex-1" />
          <DButton
            variant={captureState ? "primary" : "accent"}
            size="sm"
            onClick={() => void onToggleCapture()}
            disabled={finalizePhase !== "idle"}
          >
            {isBusy ? (
              <IconSparkles width={12} height={12} />
            ) : captureState ? (
              <IconStop width={12} height={12} />
            ) : (
              <IconMic width={12} height={12} />
            )}
            {captureLabel}
          </DButton>
          <DButton
            variant="danger"
            size="sm"
            onClick={() => setShowDeleteConfirm(true)}
            disabled={finalizePhase !== "idle"}
          >
            <IconTrash width={12} height={12} />
            Delete
          </DButton>
        </div>

        <div className="relative flex-1 min-h-0">
          <textarea
            className="h-full w-full resize-none border-none focus:outline-none text-[15px] leading-[1.7] text-fg placeholder:text-fg-subtle bg-transparent"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Write notes, or press Start recording and let Brifo listen."
            rows={16}
          />
          {finalizePhase !== "idle" && (
            <div
              className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-lg"
              style={{
                background: "rgba(250,250,247,0.92)",
                backdropFilter: "blur(4px)",
              }}
            >
              <svg
                className="animate-spin h-6 w-6"
                style={{ color: "var(--color-accent)" }}
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
              {(() => {
                const messages =
                  finalizePhase === "transcribing"
                    ? TRANSCRIBING_MESSAGES
                    : GENERATING_MESSAGES;
                const current =
                  messages[loadingMessageIndex % messages.length];
                return (
                  <p
                    key={current}
                    className="text-[13px] text-fg-muted transition-opacity duration-300"
                  >
                    {current}
                  </p>
                );
              })()}
            </div>
          )}
        </div>
      </article>

      {/* Status / error */}
      {statusText && (
        <div
          className="px-8 py-2.5 text-[12px] flex items-center gap-2"
          style={{
            borderTop: "1px solid var(--color-divider)",
            background: "var(--color-success-soft)",
            color: "var(--color-success)",
          }}
        >
          <IconCheckCircle width={12} height={12} />
          {statusText}
        </div>
      )}

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
        <div
          className="mx-6 mb-3 rounded-md px-3 py-2.5 text-[12.5px]"
          style={{
            background: "var(--color-danger-soft)",
            color: "var(--color-danger)",
            border: "1px solid rgba(180,35,24,0.18)",
          }}
        >
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
          <DButton
            variant="default"
            size="sm"
            onClick={() => setShowDeleteConfirm(false)}
          >
            Cancel
          </DButton>
          <DButton
            variant="danger"
            size="sm"
            onClick={() => {
              setShowDeleteConfirm(false);
              void onDeleteNote();
            }}
          >
            Delete
          </DButton>
        </div>
      </Dialog>
    </div>
  );
}
