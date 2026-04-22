import { useState } from "react";
import { Dialog } from "./ui/Dialog";
import { Button } from "./ui/Button";

interface Props {
  open: boolean;
  onDone: () => void;
}

type PermStatus = "idle" | "granted" | "denied";

function CheckBadge() {
  return (
    <span className="w-8 h-8 rounded-full bg-fg flex items-center justify-center shrink-0">
      <span className="material-symbols-outlined text-white text-sm">
        check
      </span>
    </span>
  );
}

export function AudioPermissionsModal({ open, onDone }: Props) {
  const [micStatus, setMicStatus] = useState<PermStatus>("idle");
  const [sysStatus, setSysStatus] = useState<PermStatus>("idle");

  async function handleMic() {
    try {
      await window.electronAPI.requestMicrophoneAccess();
      const perms = await window.electronAPI.checkPermissions();
      setMicStatus(perms.microphone === "granted" ? "granted" : "denied");
    } catch {
      setMicStatus("denied");
    }
  }

  async function handleSystemAudio() {
    try {
      const sourceId = await window.electronAPI.getScreenCaptureSourceId();
      if (sourceId) {
        setSysStatus("granted");
        localStorage.setItem("brifo_system_audio_enabled", "true");
      } else {
        setSysStatus("denied");
      }
    } catch {
      setSysStatus("denied");
    }
  }

  function handleContinue() {
    localStorage.setItem("brifo_permissions_setup", "true");
    onDone();
  }

  return (
    <Dialog open={open} onClose={handleContinue}>
      <div className="px-2 py-1 space-y-6">
        {/* Header */}
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-fg-subtle">
            Permissions
          </p>
          <h2 className="text-2xl font-serif text-fg leading-tight">
            Allow Brifo to transcribe your meetings
          </h2>
          <p className="text-sm text-fg-muted">
            Brifo transcribes meetings using your computer's audio. No bots join
            your meeting.
          </p>
        </div>

        {/* Permission rows */}
        <div className="border border-border rounded-xl overflow-hidden divide-y divide-border">
          {/* Microphone row */}
          <div className="flex items-center justify-between px-4 py-4">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-fg-muted text-xl">
                mic
              </span>
              <span className="text-sm font-medium text-fg">
                Transcribe my voice
              </span>
            </div>
            {micStatus === "granted" ? (
              <CheckBadge />
            ) : (
              <Button variant="secondary" size="sm" onClick={handleMic}>
                <span className="material-symbols-outlined text-sm mr-1">
                  mic
                </span>
                Enable Microphone
              </Button>
            )}
          </div>

          {/* System audio row */}
          <div className="flex items-center justify-between px-4 py-4">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-fg-muted text-xl">
                volume_up
              </span>
              <span className="text-sm font-medium text-fg">
                Transcribe other people's voices
              </span>
            </div>
            {sysStatus === "granted" ? (
              <CheckBadge />
            ) : (
              <Button variant="secondary" size="sm" onClick={handleSystemAudio}>
                Enable System Audio
              </Button>
            )}
          </div>
        </div>

        {/* Footer note */}
        <p className="text-xs text-fg-subtle text-center">
          System audio uses Screen Recording permission — Brifo never records
          your screen.
        </p>

        {/* Continue */}
        <Button variant="primary" size="lg" block onClick={handleContinue}>
          Continue
        </Button>
      </div>
    </Dialog>
  );
}
