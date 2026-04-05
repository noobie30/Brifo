import { useCallback, useEffect, useState } from "react";
import { Button } from "./ui";

type MicrophoneStatus =
  | "granted"
  | "denied"
  | "restricted"
  | "not-determined"
  | "unknown";

export function usePermissionsCheck() {
  const [microphoneStatus, setMicrophoneStatus] =
    useState<MicrophoneStatus>("unknown");
  const [loading, setLoading] = useState(true);

  const recheck = useCallback(async () => {
    setLoading(true);
    try {
      const result = await window.electronAPI.checkPermissions();
      setMicrophoneStatus(result.microphone as MicrophoneStatus);
    } catch {
      setMicrophoneStatus("unknown");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void recheck();
  }, [recheck]);

  const allGranted = microphoneStatus === "granted";

  return { microphoneStatus, loading, allGranted, recheck };
}

interface PermissionsGatePageProps {
  microphoneStatus: MicrophoneStatus;
  onRecheck: () => void;
  loading: boolean;
}

export function PermissionsGatePage({
  microphoneStatus,
  onRecheck,
  loading,
}: PermissionsGatePageProps) {
  const [requesting, setRequesting] = useState(false);

  async function onAllowMicrophone() {
    setRequesting(true);
    try {
      if (
        microphoneStatus === "not-determined" ||
        microphoneStatus === "unknown"
      ) {
        const granted = await window.electronAPI.requestMicrophoneAccess();
        if (granted) {
          onRecheck();
          return;
        }
      }
      // Already denied or request returned false -- open System Settings
      await window.electronAPI.openMicrophoneSettings();
    } finally {
      setRequesting(false);
    }
  }

  const isDenied =
    microphoneStatus === "denied" || microphoneStatus === "restricted";

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="max-w-sm w-full mx-auto px-6">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-accent-100 mb-4">
            <span className="material-symbols-outlined text-accent-600 text-3xl">
              mic
            </span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Microphone Access Required
          </h1>
          <p className="text-sm text-gray-500 leading-relaxed">
            Brifo needs microphone access to capture and transcribe your meeting
            audio.
          </p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 px-5 py-4 mb-6">
          <div className="flex items-center gap-4">
            {microphoneStatus === "granted" ? (
              <span className="material-symbols-outlined text-success-500 text-xl">
                check_circle
              </span>
            ) : (
              <span className="material-symbols-outlined text-error-500 text-xl">
                cancel
              </span>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900">Microphone</p>
              <p className="text-xs text-gray-500">
                {microphoneStatus === "granted"
                  ? "Permission granted"
                  : isDenied
                    ? "Permission denied -- enable in System Settings"
                    : "Not yet requested"}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <Button
            variant="primary"
            size="md"
            className="w-full justify-center"
            disabled={requesting}
            onClick={() => void onAllowMicrophone()}
          >
            <span className="material-symbols-outlined text-base">mic</span>
            {requesting
              ? "Requesting..."
              : isDenied
                ? "Open Microphone Settings"
                : "Allow Microphone Access"}
          </Button>

          <Button
            variant="secondary"
            size="md"
            className="w-full justify-center"
            loading={loading}
            onClick={onRecheck}
          >
            <span className="material-symbols-outlined text-base">refresh</span>
            Check Again
          </Button>

          {isDenied && (
            <p className="text-xs text-center text-gray-400 leading-relaxed">
              After enabling Brifo in System Settings &gt; Microphone, click
              "Check Again" above.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
