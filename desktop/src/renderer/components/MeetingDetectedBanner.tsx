import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
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
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    // Clear payload after exit animation completes
    animationTimerRef.current = setTimeout(() => {
      setPayload(null);
      animationTimerRef.current = null;
    }, ANIMATION_MS);
  }, [clearTimers]);

  const handleTakeNotes = useCallback(() => {
    if (!payload) return;
    const query = new URLSearchParams({ autoStart: "1" });
    const sourceApp = payload.sourceApp?.trim();
    if (sourceApp) query.set("source", sourceApp);
    if (payload.signalKey?.trim())
      query.set("signal", payload.signalKey.trim());
    dismiss();
    navigate(`/quick-note?${query.toString()}`);
  }, [payload, navigate, dismiss]);

  // Subscribe to IPC banner events
  useEffect(() => {
    if (!window.electronAPI?.onMeetingDetectedBanner) return;

    const unsubscribe = window.electronAPI.onMeetingDetectedBanner((data) => {
      // Cancel any pending animation cleanup from a previous banner
      clearTimers();

      setPayload({
        sourceApp: data?.sourceApp?.trim() || "Meeting App",
        signalKey: data?.signalKey?.trim() || "",
      });
      setVisible(true);

      // Auto-dismiss after timeout
      dismissTimerRef.current = setTimeout(dismiss, AUTO_DISMISS_MS);
    });

    return () => {
      unsubscribe();
      clearTimers();
    };
  }, [dismiss, clearTimers]);

  // Auto-dismiss when navigating to quick-note (user may have clicked macOS notification)
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
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-accent-100 text-accent-600 shrink-0">
          <span className="material-symbols-outlined text-lg">videocam</span>
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-800 truncate">
            Meeting detected in {payload.sourceApp || "Meeting App"}
          </p>
          <p className="text-xs text-gray-500">
            Click Take Notes to start capturing
          </p>
        </div>

        {/* Take Notes button */}
        <Button variant="primary" size="sm" onClick={handleTakeNotes}>
          Take Notes
        </Button>

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
