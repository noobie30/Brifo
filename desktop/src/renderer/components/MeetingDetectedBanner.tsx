import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getAutoCaptureState, startAutoCapture } from "../lib/auto-capture";
import { Button } from "./ui";

const AUTO_DISMISS_MS = 30_000;
const ANIMATION_MS = 300;

interface BannerPayload {
  sourceApp?: string;
  signalKey?: string;
}

export function MeetingDetectedBanner() {
  const navigate = useNavigate();
  const location = useLocation();
  const [payload, setPayload] = useState<BannerPayload | null>(null);
  const [visible, setVisible] = useState(false);
  const [captureStarted, setCaptureStarted] = useState(false);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const clearTimers = useCallback(() => {
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
    if (animationTimerRef.current) {
      clearTimeout(animationTimerRef.current);
      animationTimerRef.current = null;
    }
  }, []);

  const dismiss = useCallback(() => {
    setVisible(false);
    clearTimers();
    animationTimerRef.current = setTimeout(() => {
      setPayload(null);
      setCaptureStarted(false);
      setCaptureError(null);
      animationTimerRef.current = null;
    }, ANIMATION_MS);
  }, [clearTimers]);

  const handleViewNotes = useCallback(() => {
    if (!payload) return;
    const query = new URLSearchParams();
    const sourceApp = payload.sourceApp?.trim();
    if (sourceApp) query.set("source", sourceApp);
    if (payload.signalKey?.trim())
      query.set("signal", payload.signalKey.trim());
    dismiss();
    navigate(`/quick-note?${query.toString()}`);
  }, [payload, navigate, dismiss]);

  // Subscribe to IPC banner events and auto-start capture
  useEffect(() => {
    if (!window.electronAPI?.onMeetingDetectedBanner) return;

    const unsubscribe = window.electronAPI.onMeetingDetectedBanner((data) => {
      clearTimers();

      const sourceApp = data?.sourceApp?.trim() || "Meeting App";
      const signalKey = data?.signalKey?.trim() || "";

      setPayload({ sourceApp, signalKey });
      setCaptureError(null);
      setVisible(true);

      // Auto-dismiss after timeout
      dismissTimerRef.current = setTimeout(dismiss, AUTO_DISMISS_MS);

      // Auto-start capture if not already active
      if (getAutoCaptureState()) {
        setCaptureStarted(true);
        return;
      }

      const meetingId = signalKey
        ? `detected:${signalKey}`
        : `detected:${Date.now()}`;
      void startAutoCapture({
        meetingId,
        title: `${sourceApp} Meeting`,
        trigger: "join",
        sourceApp,
      })
        .then(() => {
          if (!isMountedRef.current) return;
          setCaptureStarted(true);
        })
        .catch((error) => {
          if (!isMountedRef.current) return;
          setCaptureStarted(false);
          setCaptureError(
            error instanceof Error
              ? error.message
              : "Unable to start capturing.",
          );
        });
    });

    return () => {
      unsubscribe();
      clearTimers();
    };
  }, [dismiss, clearTimers]);

  // Auto-dismiss when navigating to quick-note
  useEffect(() => {
    if (location.pathname.startsWith("/quick-note") && visible) {
      dismiss();
    }
  }, [location.pathname, visible, dismiss]);

  if (!payload) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 flex justify-center p-4 pointer-events-none">
      <div
        className="pointer-events-auto flex items-center gap-3 bg-white border border-gray-200 shadow-lg rounded-lg px-4 py-3 max-w-lg w-full"
        style={{
          transform: visible ? "translateY(0)" : "translateY(-100%)",
          opacity: visible ? 1 : 0,
          transition: `opacity ${ANIMATION_MS}ms ease, transform ${ANIMATION_MS}ms ease`,
        }}
      >
        {/* Meeting icon */}
        <div
          className={`flex items-center justify-center w-8 h-8 rounded-full shrink-0 ${
            captureStarted
              ? "bg-success-100 text-success-600"
              : captureError
                ? "bg-error-100 text-error-600"
                : "bg-accent-100 text-accent-600"
          }`}
        >
          <span className="material-symbols-outlined text-lg">
            {captureStarted ? "mic" : captureError ? "error" : "videocam"}
          </span>
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-800 truncate">
            {captureStarted
              ? `Capturing ${payload.sourceApp || "Meeting"}`
              : captureError
                ? "Capture failed"
                : `Meeting detected in ${payload.sourceApp || "Meeting App"}`}
          </p>
          <p className="text-xs text-gray-500">
            {captureStarted
              ? "Notes will be generated when the meeting ends"
              : captureError
                ? captureError
                : "Starting capture..."}
          </p>
        </div>

        {/* Action button */}
        {captureStarted ? (
          <Button variant="primary" size="sm" onClick={handleViewNotes}>
            View Notes
          </Button>
        ) : captureError ? (
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setCaptureError(null);
              const signalKey = payload.signalKey?.trim() || "";
              const meetingId = signalKey
                ? `detected:${signalKey}`
                : `detected:${Date.now()}`;
              void startAutoCapture({
                meetingId,
                title: `${payload.sourceApp || "Meeting"} Meeting`,
                trigger: "join",
                sourceApp: payload.sourceApp || "Meeting App",
              })
                .then(() => {
                  if (!isMountedRef.current) return;
                  setCaptureStarted(true);
                })
                .catch((err) => {
                  if (!isMountedRef.current) return;
                  setCaptureError(
                    err instanceof Error
                      ? err.message
                      : "Unable to start capturing.",
                  );
                });
            }}
          >
            Retry
          </Button>
        ) : null}

        {/* Dismiss button */}
        <button
          onClick={dismiss}
          className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          aria-label="Dismiss"
        >
          <span className="material-symbols-outlined text-lg">close</span>
        </button>
      </div>
    </div>
  );
}
