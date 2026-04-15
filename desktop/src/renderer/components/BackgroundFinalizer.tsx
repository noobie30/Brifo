import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { subscribeAutoCaptureStop, StopReason } from "../lib/auto-capture";
import {
  claimFinalization,
  finalizeCapture,
  releaseFinalization,
} from "../lib/finalize-capture";
import { Button } from "./ui";

const BANNER_AUTO_DISMISS_MS = 15_000;
const BANNER_ERROR_AUTO_DISMISS_MS = 20_000;
const BANNER_ANIMATION_MS = 300;

type BannerKind = "success" | "error";

interface BannerState {
  kind: BannerKind;
  title: string;
  message: string;
  meetingId: string;
}

function describeStopReason(reason: StopReason): string | null {
  if (reason === "stream_failed") {
    return "Audio streaming stopped responding. Check your Deepgram API key and network connection.";
  }
  if (reason === "silence") {
    return "No audio detected for several minutes — capture was stopped automatically.";
  }
  if (reason === "max_duration") {
    return "Maximum capture duration reached.";
  }
  return null;
}

/**
 * Headless component that listens for capture-stop events and
 * automatically generates document & tasks in the background.
 * Shows an in-app banner when notes are ready — or a visible error
 * banner when finalization fails.
 */
export function BackgroundFinalizer() {
  const navigate = useNavigate();
  const [banner, setBanner] = useState<BannerState | null>(null);
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => {
    setVisible(false);
    if (timerRef.current) clearTimeout(timerRef.current);
    setTimeout(() => setBanner(null), BANNER_ANIMATION_MS);
  }, []);

  const showBanner = useCallback(
    (next: BannerState, autoDismissMs: number) => {
      setBanner(next);
      setVisible(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(dismiss, autoDismissMs);
    },
    [dismiss],
  );

  useEffect(() => {
    const unsubscribe = subscribeAutoCaptureStop((event) => {
      const { meetingId, title, reason } = event;

      // Try to claim — if QuickNotePage already claimed, skip
      if (!claimFinalization(meetingId)) {
        return;
      }

      void (async () => {
        try {
          // If the stop reason itself indicates a failure (e.g. the stream
          // broke and we gave up), skip finalization and show the reason.
          const reasonMessage = describeStopReason(reason);
          if (reason === "stream_failed") {
            showBanner(
              {
                kind: "error",
                title: title || "Capture failed",
                message:
                  reasonMessage ??
                  "Capture stopped because audio could not be streamed.",
                meetingId,
              },
              BANNER_ERROR_AUTO_DISMISS_MS,
            );
            return;
          }

          const result = await finalizeCapture({
            meetingId,
            meetingTitle: title,
          });

          if (result.success) {
            showBanner(
              {
                kind: "success",
                title: title || "Meeting",
                message: "Document and tasks generated",
                meetingId,
              },
              BANNER_AUTO_DISMISS_MS,
            );
          } else {
            console.warn(
              "[BackgroundFinalizer] Finalization returned no transcript for",
              meetingId,
            );
            showBanner(
              {
                kind: "error",
                title: title || "Notes not generated",
                message:
                  reasonMessage ??
                  "No transcript was captured. Check that your audio was being streamed (Deepgram key, network, mic permission) and try again.",
                meetingId,
              },
              BANNER_ERROR_AUTO_DISMISS_MS,
            );
          }
        } catch (error) {
          console.error(
            "[BackgroundFinalizer] Failed to finalize capture:",
            error,
          );
          showBanner(
            {
              kind: "error",
              title: title || "Notes not generated",
              message:
                error instanceof Error
                  ? error.message
                  : "An unexpected error occurred while generating notes.",
              meetingId,
            },
            BANNER_ERROR_AUTO_DISMISS_MS,
          );
        } finally {
          releaseFinalization(meetingId);
        }
      })();
    });

    return () => {
      unsubscribe();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [showBanner]);

  if (!banner) return null;

  const isError = banner.kind === "error";
  const iconClass = isError
    ? "bg-error-50 text-error-600"
    : "bg-success-100 text-success-600";
  const icon = isError ? "error" : "task_alt";
  const heading = isError ? "Notes not generated" : "Notes ready";

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 flex justify-center p-4 pointer-events-none">
      <div
        className="pointer-events-auto flex items-start gap-3 bg-white border border-gray-200 shadow-lg rounded-lg px-4 py-3 max-w-lg w-full"
        style={{
          transform: visible ? "translateY(0)" : "translateY(100%)",
          opacity: visible ? 1 : 0,
          transition: `opacity ${BANNER_ANIMATION_MS}ms ease, transform ${BANNER_ANIMATION_MS}ms ease`,
        }}
        role={isError ? "alert" : "status"}
      >
        <div
          className={`flex items-center justify-center w-8 h-8 rounded-full shrink-0 ${iconClass}`}
        >
          <span className="material-symbols-outlined text-lg">{icon}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-800">{heading}</p>
          <p className="text-xs text-gray-500 mt-0.5 break-words">
            {isError ? banner.message : `${banner.title} — ${banner.message}`}
          </p>
        </div>
        {!isError && (
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              dismiss();
              navigate("/documents");
            }}
          >
            View
          </Button>
        )}
        <button
          onClick={dismiss}
          className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors shrink-0"
          aria-label="Dismiss"
        >
          <span className="material-symbols-outlined text-lg">close</span>
        </button>
      </div>
    </div>
  );
}
