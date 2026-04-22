import { useEffect, useState } from "react";
import {
  AutoCaptureState,
  subscribeAutoCapture,
} from "../lib/auto-capture";

const DISMISS_KEY = "brifo_sys_audio_warning_dismissed";

export function SystemAudioWarningBanner() {
  const [state, setState] = useState<AutoCaptureState | null>(null);
  const [dismissedFor, setDismissedFor] = useState<string | null>(
    () => sessionStorage.getItem(DISMISS_KEY),
  );

  useEffect(() => subscribeAutoCapture(setState), []);

  const shouldShow =
    state?.status === "recording" &&
    state.systemAudioStatus === "unavailable" &&
    dismissedFor !== state.meetingId;

  if (!shouldShow || !state) return null;

  function dismiss() {
    if (!state) return;
    sessionStorage.setItem(DISMISS_KEY, state.meetingId);
    setDismissedFor(state.meetingId);
  }

  async function openScreenSettings() {
    try {
      await window.electronAPI.openScreenRecordingSettings?.();
    } catch {
      // Fallback handled by main process; nothing to do here.
    }
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-40 flex justify-center p-3 pointer-events-none">
      <div
        className="pointer-events-auto flex items-start gap-3 bg-white border border-amber-300 shadow-md rounded-lg px-4 py-3 max-w-xl w-full"
        role="alert"
      >
        <div className="flex items-center justify-center w-8 h-8 rounded-full shrink-0 bg-amber-100 text-amber-700">
          <span className="material-symbols-outlined text-lg">warning</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-800">
            Only your voice is being transcribed
          </p>
          <p className="text-xs text-gray-500 mt-0.5 break-words">
            System audio capture is off — other participants won&rsquo;t appear
            in the transcript. Grant <strong>Screen Recording</strong> in
            System Settings and restart Brifo to transcribe everyone.
          </p>
        </div>
        <button
          onClick={() => void openScreenSettings()}
          className="px-3 py-1.5 text-xs font-medium text-amber-900 bg-amber-100 hover:bg-amber-200 rounded-md transition-colors shrink-0"
        >
          Open settings
        </button>
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
