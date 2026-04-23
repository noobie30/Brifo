import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Card, DButton, PageHeader } from "../components/design";
import { IconArrowLeft } from "../components/icons";

interface PermissionsState {
  microphone: string;
  camera: string;
  screen: string;
  isDev: boolean;
}

interface MicTestResult {
  peakRms: number;
  meanRms: number;
  sampleRate: number;
  bytesCaptured: number;
  durationMs: number;
}

interface BackendHealth {
  status?: string;
  database?: string;
  deepgram?: "configured" | "missing";
  openai?: "configured" | "missing";
  service?: string;
  timestamp?: string;
}

interface BackendPing {
  url: string;
  latencyMs: number;
  health: BackendHealth | null;
  error: string | null;
}

const TEST_DURATION_MS = 3000;

function StatusPill({
  tone,
  children,
}: {
  tone: "ok" | "warn" | "error" | "neutral";
  children: React.ReactNode;
}) {
  const styles: Record<string, React.CSSProperties> = {
    ok: { background: "rgba(16,185,129,0.10)", color: "rgb(6,95,70)" },
    warn: { background: "rgba(245,158,11,0.10)", color: "rgb(146,64,14)" },
    error: { background: "rgba(239,68,68,0.10)", color: "rgb(127,29,29)" },
    neutral: { background: "var(--color-subtle)", color: "var(--color-fg-2)" },
  };
  return (
    <span
      className="inline-flex items-center px-2 py-[2px] rounded-md text-[11.5px] font-medium"
      style={styles[tone]}
    >
      {children}
    </span>
  );
}

function permissionTone(value: string): "ok" | "warn" | "error" | "neutral" {
  if (value === "granted") return "ok";
  if (value === "denied" || value === "restricted") return "error";
  if (value === "not-determined") return "warn";
  return "neutral";
}

export function DiagnosticsPage() {
  const navigate = useNavigate();
  const [permissions, setPermissions] = useState<PermissionsState | null>(null);
  const [permissionsError, setPermissionsError] = useState<string | null>(null);
  const [micTestRunning, setMicTestRunning] = useState(false);
  const [micTestResult, setMicTestResult] = useState<MicTestResult | null>(null);
  const [micTestError, setMicTestError] = useState<string | null>(null);
  const [backendPing, setBackendPing] = useState<BackendPing | null>(null);
  const [backendPinging, setBackendPinging] = useState(false);
  const isMountedRef = useRef(true);

  const apiUrl =
    (import.meta.env.VITE_API_URL?.trim() as string | undefined) ??
    "http://localhost:3001/api";

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const refreshPermissions = async () => {
    setPermissionsError(null);
    try {
      const result = await window.electronAPI.checkPermissions();
      if (!isMountedRef.current) return;
      setPermissions(result);
    } catch (error) {
      if (!isMountedRef.current) return;
      setPermissionsError(
        error instanceof Error ? error.message : String(error),
      );
    }
  };

  useEffect(() => {
    void refreshPermissions();
  }, []);

  const runMicTest = async () => {
    setMicTestRunning(true);
    setMicTestError(null);
    setMicTestResult(null);

    let stream: MediaStream | null = null;
    let context: AudioContext | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      context = new AudioContext();
      const source = context.createMediaStreamSource(stream);
      const processor = context.createScriptProcessor(4096, 1, 1);
      const sampleRate = context.sampleRate;

      let peakRms = 0;
      let totalRms = 0;
      let frames = 0;
      let bytesCaptured = 0;
      const startedAt = performance.now();

      processor.onaudioprocess = (event) => {
        const data = event.inputBuffer.getChannelData(0);
        let squareSum = 0;
        for (let i = 0; i < data.length; i += 1) {
          squareSum += data[i] * data[i];
        }
        const rms = Math.sqrt(squareSum / data.length);
        if (rms > peakRms) peakRms = rms;
        totalRms += rms;
        frames += 1;
        bytesCaptured += data.length * 2; // int16 == 2 bytes
      };

      source.connect(processor);
      processor.connect(context.destination);

      await new Promise((resolve) => setTimeout(resolve, TEST_DURATION_MS));

      processor.disconnect();
      source.disconnect();

      if (!isMountedRef.current) return;
      setMicTestResult({
        peakRms,
        meanRms: frames > 0 ? totalRms / frames : 0,
        sampleRate,
        bytesCaptured,
        durationMs: performance.now() - startedAt,
      });
    } catch (error) {
      if (!isMountedRef.current) return;
      setMicTestError(error instanceof Error ? error.message : String(error));
    } finally {
      if (stream) stream.getTracks().forEach((track) => track.stop());
      if (context) {
        try {
          await context.close();
        } catch {
          // ignore
        }
      }
      if (isMountedRef.current) setMicTestRunning(false);
    }
  };

  const pingBackend = async () => {
    setBackendPinging(true);
    const startedAt = performance.now();
    try {
      const response = await axios.get(`${apiUrl}/health`, { timeout: 8000 });
      if (!isMountedRef.current) return;
      setBackendPing({
        url: `${apiUrl}/health`,
        latencyMs: performance.now() - startedAt,
        health: response.data as BackendHealth,
        error: null,
      });
    } catch (error) {
      if (!isMountedRef.current) return;
      setBackendPing({
        url: `${apiUrl}/health`,
        latencyMs: performance.now() - startedAt,
        health: null,
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      if (isMountedRef.current) setBackendPinging(false);
    }
  };

  useEffect(() => {
    void pingBackend();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const peakRmsLabel = micTestResult
    ? micTestResult.peakRms === 0
      ? "0.000 (silence — mic muted or wrong device?)"
      : micTestResult.peakRms.toFixed(3)
    : "—";

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2 px-8 pt-5">
        <button
          type="button"
          onClick={() => navigate("/settings")}
          className="inline-flex items-center gap-1.5 text-[12px] text-fg-muted hover:text-fg cursor-pointer"
        >
          <IconArrowLeft width={12} height={12} />
          Settings
        </button>
        <span className="text-[12px] text-fg-subtle">/</span>
        <span className="text-[12px] text-fg-subtle">Diagnostics</span>
      </div>

      <PageHeader
        eyebrow="Troubleshooting"
        title="Diagnostics"
        subtitle="Verify mic permissions, audio capture, and backend connectivity. Use this when transcripts aren't being captured or notes won't generate."
      />

      <div className="px-8 pb-10 grid gap-5 max-w-3xl mx-auto w-full">
        {/* Permissions */}
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[15px] font-semibold text-fg m-0">
              macOS permissions
            </h2>
            <DButton onClick={() => void refreshPermissions()}>Refresh</DButton>
          </div>
          {permissionsError ? (
            <p className="text-[12.5px] text-danger">{permissionsError}</p>
          ) : permissions ? (
            <div className="grid gap-2 text-[13px]">
              <div className="flex items-center justify-between">
                <span className="text-fg-2">Microphone</span>
                <StatusPill tone={permissionTone(permissions.microphone)}>
                  {permissions.microphone}
                </StatusPill>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-fg-2">Screen Recording</span>
                <StatusPill tone={permissionTone(permissions.screen)}>
                  {permissions.screen}
                </StatusPill>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-fg-2">Camera</span>
                <StatusPill tone={permissionTone(permissions.camera)}>
                  {permissions.camera}
                </StatusPill>
              </div>
              <div className="flex items-center justify-between mt-1 pt-2 border-t border-line">
                <span className="text-fg-muted text-[12px]">
                  Dev build (Electron Helper)
                </span>
                <span className="text-[12px] text-fg-muted mono">
                  {permissions.isDev ? "yes" : "no"}
                </span>
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                <DButton
                  onClick={() => void window.electronAPI.openMicrophoneSettings()}
                >
                  Open Microphone settings
                </DButton>
                <DButton
                  onClick={() =>
                    void window.electronAPI.openScreenRecordingSettings()
                  }
                >
                  Open Screen Recording settings
                </DButton>
              </div>
            </div>
          ) : (
            <p className="text-[12.5px] text-fg-muted">Checking…</p>
          )}
        </Card>

        {/* Mic test */}
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[15px] font-semibold text-fg m-0">
              Microphone capture test (3 s)
            </h2>
            <DButton onClick={() => void runMicTest()} disabled={micTestRunning}>
              {micTestRunning ? "Recording…" : "Start test"}
            </DButton>
          </div>
          <p className="text-[12px] text-fg-muted mb-3">
            Captures 3 seconds locally (no upload) and reports the loudest
            sample. A peak RMS near 0 means the input device is producing pure
            silence — likely muted, the wrong device, or system input level at 0.
          </p>
          {micTestError && (
            <p className="text-[12.5px] text-danger mb-2">{micTestError}</p>
          )}
          {micTestResult && (
            <div className="grid gap-1.5 text-[12.5px] mono">
              <div className="flex justify-between">
                <span className="text-fg-muted">Peak RMS</span>
                <span className="text-fg">{peakRmsLabel}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-fg-muted">Mean RMS</span>
                <span className="text-fg">
                  {micTestResult.meanRms.toFixed(4)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-fg-muted">Sample rate</span>
                <span className="text-fg">{micTestResult.sampleRate} Hz</span>
              </div>
              <div className="flex justify-between">
                <span className="text-fg-muted">Bytes captured</span>
                <span className="text-fg">
                  {(micTestResult.bytesCaptured / 1024).toFixed(1)} KB (PCM16)
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-fg-muted">Duration</span>
                <span className="text-fg">
                  {(micTestResult.durationMs / 1000).toFixed(2)} s
                </span>
              </div>
            </div>
          )}
        </Card>

        {/* Backend */}
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[15px] font-semibold text-fg m-0">
              Backend health
            </h2>
            <DButton onClick={() => void pingBackend()} disabled={backendPinging}>
              {backendPinging ? "Pinging…" : "Re-check"}
            </DButton>
          </div>
          <div className="grid gap-1.5 text-[12.5px]">
            <div className="flex justify-between">
              <span className="text-fg-muted">API URL</span>
              <span className="text-fg mono break-all">{apiUrl}</span>
            </div>
            {backendPing && (
              <>
                <div className="flex justify-between">
                  <span className="text-fg-muted">Latency</span>
                  <span className="text-fg mono">
                    {backendPing.latencyMs.toFixed(0)} ms
                  </span>
                </div>
                {backendPing.error ? (
                  <div className="mt-2">
                    <StatusPill tone="error">unreachable</StatusPill>
                    <p className="text-[12px] text-danger mt-1">
                      {backendPing.error}
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between">
                      <span className="text-fg-muted">Status</span>
                      <StatusPill
                        tone={
                          backendPing.health?.status === "ok" ? "ok" : "warn"
                        }
                      >
                        {backendPing.health?.status ?? "unknown"}
                      </StatusPill>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-fg-muted">Database</span>
                      <StatusPill
                        tone={
                          backendPing.health?.database === "connected"
                            ? "ok"
                            : "error"
                        }
                      >
                        {backendPing.health?.database ?? "unknown"}
                      </StatusPill>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-fg-muted">Deepgram key</span>
                      <StatusPill
                        tone={
                          backendPing.health?.deepgram === "configured"
                            ? "ok"
                            : "error"
                        }
                      >
                        {backendPing.health?.deepgram ?? "unknown"}
                      </StatusPill>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-fg-muted">OpenAI key</span>
                      <StatusPill
                        tone={
                          backendPing.health?.openai === "configured"
                            ? "ok"
                            : "warn"
                        }
                      >
                        {backendPing.health?.openai ?? "unknown"}
                      </StatusPill>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
