import { useEffect, useState } from "react";
import { Button } from "./ui";

interface PermissionErrorBannerProps {
  error: string;
  onRetry: () => void;
  onDismiss: () => void;
}

export function PermissionErrorBanner({
  error,
  onRetry,
  onDismiss,
}: PermissionErrorBannerProps) {
  const [requesting, setRequesting] = useState(false);
  const [isDev, setIsDev] = useState(false);

  useEffect(() => {
    window.electronAPI
      .checkPermissions()
      .then((result) => {
        setIsDev(result.isDev);
      })
      .catch(() => {});
  }, []);

  async function onGrantMicrophone() {
    setRequesting(true);
    try {
      const granted = await window.electronAPI.requestMicrophoneAccess();
      if (granted) {
        onRetry();
        return;
      }
      await window.electronAPI.openMicrophoneSettings();
    } finally {
      setRequesting(false);
    }
  }

  return (
    <div className="bg-error-50 border border-error-200 rounded-lg px-4 py-3 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-error-700">{error}</p>
        <button
          type="button"
          className="text-error-400 hover:text-error-600 shrink-0"
          onClick={onDismiss}
          aria-label="Dismiss"
        >
          <span className="material-symbols-outlined text-base">close</span>
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={requesting}
          onClick={() => void onGrantMicrophone()}
        >
          <span className="material-symbols-outlined text-base">mic</span>
          {requesting ? "Requesting..." : "Grant Microphone Access"}
        </Button>

        <Button variant="primary" size="sm" onClick={onRetry}>
          <span className="material-symbols-outlined text-base">refresh</span>
          Try Again
        </Button>
      </div>

      {isDev && (
        <p className="text-xs text-error-500">
          Dev mode: Look for <strong>"Electron"</strong> (not "Brifo") in System
          Settings &gt; Privacy &amp; Security &gt; Microphone and enable it.
          The app will appear as "Brifo" only when built as a .app bundle.
        </p>
      )}
    </div>
  );
}
