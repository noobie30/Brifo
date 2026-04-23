import {
  ApiError,
  LiveTranscriptSegment,
  sendStreamAudio,
  startMeeting,
  startTranscriptStream,
  stopMeeting,
  stopTranscriptStream,
} from "./api";

type CaptureTrigger = "join" | "calendar";
export type StopReason =
  | "manual"
  | "silence"
  | "meeting_end"
  | "max_duration"
  | "replaced"
  | "stream_failed";

// Whether the second audio source (other participants, via macOS screen-audio
// tap) is currently mixed into the PCM stream sent to Deepgram.
//   "disabled"    — user opted out, or capture hasn't started yet
//   "unavailable" — enabled but we couldn't get the stream (permission denied,
//                   no screen source, or getUserMedia rejected)
//   "active"      — enabled and the stream is being mixed in
export type SystemAudioStatus = "disabled" | "unavailable" | "active";

export interface AutoCaptureStopEvent {
  meetingId: string;
  title: string;
  reason: StopReason;
}

export interface AutoCaptureState {
  meetingId: string;
  title: string;
  sourceApp: string;
  trigger: CaptureTrigger;
  startedAt: number;
  status: "starting" | "recording" | "stopping";
  // True when the capture is tied to a real meeting (join URL or calendar
  // event). False for Quick Notes started without a meeting context — the
  // main-process meeting detector must NOT fire "meeting-ended" for these,
  // since there is no meeting to end.
  expectsMeetingSignal: boolean;
  systemAudioStatus: SystemAudioStatus;
}

export interface MeetingDetectedNotice {
  meetingId: string;
  title: string;
  sourceApp: string;
  trigger: CaptureTrigger;
  detectedAt: number;
}

interface StartCaptureInput {
  meetingId: string;
  title: string;
  trigger: CaptureTrigger;
  endTime?: string | null;
  joinUrl?: string | null;
  sourceApp?: string;
  calendarEventId?: string;
}

const SILENCE_STOP_MS = 3 * 60 * 1000;
const SILENCE_SAMPLE_MS = 2000;
// Hard ceiling for a single capture. 4 hours catches the "user forgot to
// stop" case while still being generous for long workshops. Meetings that
// legitimately run longer can restart capture manually.
const MAX_DURATION_MS = 4 * 60 * 60 * 1000;
const CALENDAR_AUTO_WINDOW_MS = 90 * 1000;
const STREAM_INTERVAL_MS = 250; // Send PCM audio every 250ms

let activeState: AutoCaptureState | null = null;
let micStream: MediaStream | null = null;
let audioContext: AudioContext | null = null;
let analyserNode: AnalyserNode | null = null;
let analyserTimer: number | null = null;
let endTimer: number | null = null;
let maxTimer: number | null = null;
let lastAudioDetectedAt = 0;
let stopInProgress = false;
let streamingActive = false;
let pcmStreamTimer: number | null = null;
let scriptProcessorNode: ScriptProcessorNode | null = null;
let pcmBuffer: Int16Array[] = [];
let consecutiveStreamFailures = 0;
let totalBytesStreamed = 0;
// 120 × 250ms = 30s tolerance. Brief Vercel instance recycles during long
// meetings can cause a short burst of failures while the backend re-opens
// the Deepgram session; this lets capture ride through them instead of
// aborting the whole meeting.
const MAX_STREAM_FAILURES = 120;
// Throttle how often we proactively ask the backend to re-open the
// streaming session from the client side (avoid stampeding during a spike
// of failures).
const STREAM_RECONNECT_COOLDOWN_MS = 5000;
// Cap consecutive reconnect attempts. With a 5 s cooldown this bounds
// retries to ~15 s for a permanently broken stream (e.g. invalid auth or
// network outage) instead of retrying forever. Successful audio send
// resets the counter.
const MAX_RECONNECT_ATTEMPTS = 3;
let lastReconnectAttemptAt = 0;
let consecutiveReconnectFailures = 0;

const listeners = new Set<(state: AutoCaptureState | null) => void>();
const noticeListeners = new Set<
  (notice: MeetingDetectedNotice | null) => void
>();
const stopListeners = new Set<(event: AutoCaptureStopEvent) => void>();
const calendarAutoStarted = new Set<string>();

// ── Stream health (exposed for diagnostic UI) ──────────────────────────
export interface StreamStats {
  bytesStreamed: number;
  consecutiveFailures: number;
  consecutiveReconnects: number;
  lastError: string | null;
  // Backend-reported counters (from the /transcript/stream/audio response).
  // segmentsAccepted is what Deepgram returned AND we successfully persisted.
  // segmentsDropped is the difference between Deepgram-returned and
  // persisted (Mongo write failed after retries on the backend). When the
  // bytes climb but segmentsAccepted stays at 0, audio is reaching us but
  // Deepgram is producing nothing — useful diagnostic for the user.
  segmentsAccepted: number;
  segmentsDropped: number;
  lastBackendError: string | null;
  // Why system audio is unavailable, when it is. Populated during capture
  // start from getMixedAudioStreams so UI layers can distinguish "Screen
  // Recording permission denied" from "getUserMedia threw NotAllowedError"
  // from "no audio track" — otherwise they all collapse to "unavailable".
  systemAudioReason: string | null;
}

let streamStats: StreamStats = {
  bytesStreamed: 0,
  consecutiveFailures: 0,
  consecutiveReconnects: 0,
  lastError: null,
  segmentsAccepted: 0,
  segmentsDropped: 0,
  lastBackendError: null,
  systemAudioReason: null,
};
const streamStatsListeners = new Set<(stats: StreamStats) => void>();

// ── Live transcript (surfaced to Quick Note text area while recording) ─
// Deepgram is asynchronous — between our 250 ms audio posts it may emit
// zero, one, or several finalized segments. The backend drains them on
// each /transcript/stream/audio response; we accumulate the history here
// and notify subscribers so the UI can render them live.
export type LiveTranscript = ReadonlyArray<LiveTranscriptSegment>;
let liveTranscript: LiveTranscriptSegment[] = [];
const liveTranscriptListeners = new Set<(transcript: LiveTranscript) => void>();

export function getLiveTranscript(): LiveTranscript {
  return liveTranscript;
}

export function subscribeLiveTranscript(
  listener: (transcript: LiveTranscript) => void,
): () => void {
  liveTranscriptListeners.add(listener);
  listener(liveTranscript);
  return () => {
    liveTranscriptListeners.delete(listener);
  };
}

function emitLiveTranscript() {
  for (const listener of liveTranscriptListeners) {
    try {
      listener(liveTranscript);
    } catch (error) {
      console.error(
        "[brifo][auto-capture] live transcript listener threw:",
        error instanceof Error ? error.message : error,
      );
    }
  }
}

function resetLiveTranscript() {
  liveTranscript = [];
  emitLiveTranscript();
}

export function getStreamStats(): StreamStats {
  return streamStats;
}

export function subscribeStreamStats(
  listener: (stats: StreamStats) => void,
): () => void {
  streamStatsListeners.add(listener);
  listener(streamStats);
  return () => {
    streamStatsListeners.delete(listener);
  };
}

function emitStreamStats() {
  for (const listener of streamStatsListeners) {
    try {
      listener(streamStats);
    } catch (error) {
      console.error(
        "[brifo][auto-capture] stream stats listener threw:",
        error instanceof Error ? error.message : error,
      );
    }
  }
}

function resetStreamStats() {
  streamStats = {
    bytesStreamed: 0,
    consecutiveFailures: 0,
    consecutiveReconnects: 0,
    lastError: null,
    segmentsAccepted: 0,
    segmentsDropped: 0,
    lastBackendError: null,
    systemAudioReason: null,
  };
  emitStreamStats();
}

// Listen for meeting-ended signal from main process. Main fires this only
// after MEETING_GONE_STOP_DELAY_MS of no detectable meeting signal (30s) —
// see desktop/src/main/index.ts runMeetingDetectorTick capture branch.
try {
  window.electronAPI?.onMeetingEnded?.(() => {
    if (activeState && activeState.status === "recording") {
      console.log(
        "[brifo][auto-capture] Meeting ended signal received — stopping capture.",
      );
      void stopAutoCapture("meeting_end");
    }
  });
} catch {
  // Non-Electron environment — ignore.
}
let lastDetectedNotice: MeetingDetectedNotice | null = null;

function detectSourceApp(input: StartCaptureInput): string {
  const explicit = input.sourceApp?.trim();
  if (explicit) {
    return explicit;
  }

  if (input.joinUrl) {
    try {
      const host = new URL(input.joinUrl).hostname.toLowerCase();
      if (host.includes("zoom.us")) {
        return "Zoom";
      }
      if (
        host.includes("meet.google.com") ||
        host.includes("teams.microsoft.com")
      ) {
        return "Chrome";
      }
      if (host.includes("webex.com")) {
        return "Webex";
      }
      return "Browser";
    } catch {
      // Ignore malformed URL and fall back to trigger-based source.
    }
  }

  return input.trigger === "calendar" ? "Google Calendar" : "Chrome";
}

function emitState() {
  try {
    window.electronAPI.setCaptureActive(!!activeState, {
      expectsMeetingSignal: activeState?.expectsMeetingSignal ?? false,
    });
  } catch {
    // Main process bridge may be unavailable in non-Electron environments.
  }
  for (const listener of listeners) {
    listener(activeState);
  }
}

function emitNotice() {
  for (const listener of noticeListeners) {
    listener(lastDetectedNotice);
  }
}

function stopAllTracks(stream: MediaStream | null) {
  if (!stream) {
    return;
  }
  stream.getTracks().forEach((track) => track.stop());
}

function clearTimers() {
  if (analyserTimer !== null) {
    window.clearInterval(analyserTimer);
    analyserTimer = null;
  }
  if (endTimer !== null) {
    window.clearTimeout(endTimer);
    endTimer = null;
  }
  if (maxTimer !== null) {
    window.clearTimeout(maxTimer);
    maxTimer = null;
  }
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error ?? "");
}

export class PermissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PermissionError";
  }
}

// Thrown when the backend reports DEEPGRAM_API_KEY is missing. Distinct from
// PermissionError so callers (banners, QuickNotePage) can show a different
// message — this is a server-side config problem, not a macOS permission.
export class TranscriptionDisabledError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TranscriptionDisabledError";
  }
}

function isPermissionRelated(message: string): boolean {
  return (
    message.includes("notallowederror") ||
    message.includes("permission") ||
    message.includes("denied")
  );
}

function buildCaptureStartError(micError: unknown): Error {
  const micMessage = getErrorMessage(micError).toLowerCase();
  const errorName =
    micError && typeof micError === "object" && "name" in micError
      ? String((micError as { name?: unknown }).name ?? "")
      : "";

  if (isPermissionRelated(micMessage)) {
    return new PermissionError(
      "Microphone access is required. Please grant Brifo microphone permission in System Settings and try again.",
    );
  }

  if (
    micMessage.includes("not supported") ||
    micMessage.includes("notsupportederror")
  ) {
    return new Error(
      "This environment does not support audio capture. Brifo needs microphone permission to listen.",
    );
  }

  // NotReadableError = the mic hardware is busy — typically another macOS app
  // (Claude desktop, Notra, Zoom, another Chrome tab, etc.) is holding an
  // exclusive audio stream. Tell the user concretely instead of the generic
  // "check permissions" message, which permissions aren't the problem.
  if (errorName === "NotReadableError" || micMessage.includes("could not start audio source")) {
    return new Error(
      "Another app is using your microphone. Quit other recording apps (Claude, Notra, Zoom, Meet tabs) and try again.",
    );
  }

  if (errorName === "NotFoundError") {
    return new Error(
      "No microphone found. Plug in or enable an input device in System Settings → Sound and try again.",
    );
  }

  if (errorName === "OverconstrainedError") {
    return new Error(
      "Your microphone rejected the audio settings. Brifo will retry with simpler settings — try again.",
    );
  }

  // Fallback — surface the DOMException name so the exact cause is visible
  // without needing devtools. Previously this was a generic string that
  // discarded the one piece of info that would name the root cause.
  const suffix = errorName ? ` (${errorName})` : "";
  return new Error(
    `Unable to start capturing${suffix}. Check microphone permissions and that no other app is using the mic, then try again.`,
  );
}

async function ensureMicrophonePermission(): Promise<void> {
  // Trigger the native macOS permission dialog via the main process. The
  // real getUserMedia call in getMixedAudioStreams below will then either
  // succeed (grant persists) or surface the specific DOMException.
  //
  // We intentionally DO NOT do a second "test" getUserMedia here like we
  // used to — on macOS that double-acquire sometimes strands the audio
  // device in a half-released state, and the real call then fails with
  // NotReadableError even though permissions are fine. One acquisition is
  // enough.
  try {
    const permissions = await window.electronAPI.checkPermissions();
    if (permissions.microphone === "not-determined") {
      await window.electronAPI.requestMicrophoneAccess();
    }
  } catch {
    // electronAPI may be unavailable in non-Electron environments
  }
}

function scheduleAutoStops(endTime?: string | null) {
  const now = Date.now();

  if (endTime) {
    const endMs = new Date(endTime).getTime();
    if (Number.isFinite(endMs) && endMs > now) {
      const delay = Math.max(1000, endMs - now + 2 * 60 * 1000);
      endTimer = window.setTimeout(() => {
        void stopAutoCapture("meeting_end");
      }, delay);
    }
  }

  maxTimer = window.setTimeout(() => {
    void stopAutoCapture("max_duration");
  }, MAX_DURATION_MS);
}

function setupSilenceDetection(stream: MediaStream) {
  if (!audioContext) {
    return;
  }

  const source = audioContext.createMediaStreamSource(stream);
  analyserNode = audioContext.createAnalyser();
  analyserNode.fftSize = 2048;
  source.connect(analyserNode);
  lastAudioDetectedAt = Date.now();
  let everSawAnySignal = false;
  const startedAt = Date.now();
  const MIC_SIGNAL_GRACE_MS = 5000;

  analyserTimer = window.setInterval(() => {
    if (!analyserNode) {
      return;
    }

    const data = new Uint8Array(analyserNode.fftSize);
    analyserNode.getByteTimeDomainData(data);

    let squareSum = 0;
    for (let index = 0; index < data.length; index += 1) {
      const normalized = (data[index] - 128) / 128;
      squareSum += normalized * normalized;
    }
    const rms = Math.sqrt(squareSum / data.length);
    if (rms > 0) {
      everSawAnySignal = true;
    }
    if (rms > 0.015) {
      lastAudioDetectedAt = Date.now();
      return;
    }

    // Early dead-mic check: 5 s after start, if we haven't observed *any*
    // non-zero RMS (not just below the speech threshold), the input device
    // is producing pure silence — likely a muted, disconnected, or dummy
    // device. Warn loudly so the user can investigate before the 3-minute
    // silence timeout fires.
    const elapsed = Date.now() - startedAt;
    if (
      !everSawAnySignal &&
      elapsed >= MIC_SIGNAL_GRACE_MS &&
      elapsed < MIC_SIGNAL_GRACE_MS + SILENCE_SAMPLE_MS
    ) {
      console.warn(
        "[brifo][auto-capture] No audio signal from microphone after 5s — input device may be muted, disconnected, or dummy.",
      );
    }

    if (Date.now() - lastAudioDetectedAt > SILENCE_STOP_MS) {
      void stopAutoCapture("silence");
    }
  }, SILENCE_SAMPLE_MS);
}

// Read the user's system-audio preference. Default ON when unset so first-run
// captures include others' voices by default. The actual capture uses
// AudioTee (Core Audio Taps, macOS 14.2+) which requires the separate
// "System Audio Recording Only" permission — distinct from Screen Recording.
function isSystemAudioEnabled(): boolean {
  const preference = localStorage.getItem("brifo_system_audio_enabled");
  return preference === null ? true : preference === "true";
}

// AudioTee (Core Audio Taps) emits interleaved mono Float32 PCM at the sample
// rate we request. Convert to the Int16 format Deepgram ingests and append to
// the shared system-audio buffer so setupPcmStreaming can mix it with mic PCM.
const SYS_AUDIO_SAMPLE_RATE = 16000;
let sysAudioBuffer: Int16Array[] = [];
let sysAudioDataUnsubscribe: (() => void) | null = null;
let sysAudioErrorUnsubscribe: (() => void) | null = null;
let sysAudioEndedUnsubscribe: (() => void) | null = null;

function ingestSystemAudioChunk(chunk: Uint8Array) {
  // AudioTee's default stdout format is 32-bit float mono at the requested
  // sample rate. The chunk's byteLength must be a multiple of 4 (one float
  // per sample). Anything else means a protocol mismatch — drop and log.
  if (chunk.byteLength === 0 || chunk.byteLength % 4 !== 0) {
    console.warn(
      "[brifo][auto-capture] Unexpected system-audio chunk size:",
      chunk.byteLength,
    );
    return;
  }
  const float = new Float32Array(
    chunk.buffer,
    chunk.byteOffset,
    chunk.byteLength / 4,
  );
  const int16 = new Int16Array(float.length);
  for (let i = 0; i < float.length; i += 1) {
    const clamped = Math.max(-1, Math.min(1, float[i] ?? 0));
    int16[i] = Math.round(clamped * 32767);
  }
  sysAudioBuffer.push(int16);
}

async function startSystemAudioCapture(): Promise<{
  status: SystemAudioStatus;
  reason: string | null;
}> {
  if (!window.electronAPI?.startSystemAudio) {
    return {
      status: "unavailable",
      reason: "Brifo was built without system-audio support.",
    };
  }

  sysAudioBuffer = [];
  sysAudioDataUnsubscribe?.();
  sysAudioDataUnsubscribe = window.electronAPI.onSystemAudioData(
    ingestSystemAudioChunk,
  );
  sysAudioErrorUnsubscribe?.();
  sysAudioErrorUnsubscribe = window.electronAPI.onSystemAudioError((msg) => {
    console.warn("[brifo][auto-capture] system audio error:", msg);
    if (activeState && activeState.systemAudioStatus === "active") {
      activeState = { ...activeState, systemAudioStatus: "unavailable" };
      emitState();
      streamStats = {
        ...streamStats,
        systemAudioReason: msg,
      };
      emitStreamStats();
    }
  });
  sysAudioEndedUnsubscribe?.();
  sysAudioEndedUnsubscribe = window.electronAPI.onSystemAudioEnded(() => {
    if (activeState && activeState.systemAudioStatus === "active") {
      activeState = { ...activeState, systemAudioStatus: "unavailable" };
      emitState();
    }
  });

  const result = await window.electronAPI.startSystemAudio({
    sampleRate: SYS_AUDIO_SAMPLE_RATE,
    chunkDurationMs: 250,
  });

  if (!result.ok) {
    stopSystemAudioSubscriptions();
    return {
      status: "unavailable",
      reason: result.error || "AudioTee failed to start.",
    };
  }

  return { status: "active", reason: null };
}

function stopSystemAudioSubscriptions() {
  sysAudioDataUnsubscribe?.();
  sysAudioDataUnsubscribe = null;
  sysAudioErrorUnsubscribe?.();
  sysAudioErrorUnsubscribe = null;
  sysAudioEndedUnsubscribe?.();
  sysAudioEndedUnsubscribe = null;
}

async function stopSystemAudioCapture(): Promise<void> {
  stopSystemAudioSubscriptions();
  sysAudioBuffer = [];
  try {
    await window.electronAPI?.stopSystemAudio?.();
  } catch (error) {
    console.warn(
      "[brifo][auto-capture] stopSystemAudio failed:",
      error instanceof Error ? error.message : error,
    );
  }
}

interface MixedAudioResult {
  stream: MediaStream;
  systemAudioStatus: SystemAudioStatus;
  systemAudioReason: string | null;
}

async function getMixedAudioStreams(): Promise<MixedAudioResult> {
  await ensureMicrophonePermission();

  // Defensive cleanup: if a previous capture attempt left a micStream
  // around (e.g. React StrictMode double-init, crash between start/stop),
  // release it before asking for a fresh one. macOS can otherwise return
  // NotReadableError because the old track still owns the device.
  stopAllTracks(micStream);
  micStream = null;

  const primaryConstraints: MediaStreamConstraints = {
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
    },
  };
  try {
    micStream = await navigator.mediaDevices.getUserMedia(primaryConstraints);
  } catch (error) {
    const anyErr = error as { name?: string };

    // OverconstrainedError: the mic driver rejected our echoCancellation /
    // noiseSuppression combo. Retry once with plain { audio: true } which
    // every driver accepts.
    if (anyErr?.name === "OverconstrainedError") {
      try {
        micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (retryError) {
        micStream = null;
        throw buildCaptureStartError(retryError);
      }
    } else {
      micStream = null;
      throw buildCaptureStartError(error);
    }
  }

  if (!micStream || !micStream.getAudioTracks().length) {
    throw buildCaptureStartError(new Error("No microphone track available."));
  }

  // Route mic through an AudioContext so silence detection and PCM
  // streaming share one consistent MediaStream. System audio (others'
  // voices) is no longer mixed here — it flows in via the AudioTee IPC
  // bridge and is combined with mic PCM inside setupPcmStreaming's
  // periodic flush. This avoids the Screen Recording permission class
  // entirely and puts Brifo in the "System Audio Recording Only" pane,
  // same privacy class as Granola.
  audioContext = new AudioContext();
  const destination = audioContext.createMediaStreamDestination();
  const micSource = audioContext.createMediaStreamSource(
    new MediaStream(micStream.getAudioTracks()),
  );
  micSource.connect(destination);

  let systemAudioStatus: SystemAudioStatus = "disabled";
  let systemAudioReason: string | null = null;
  if (isSystemAudioEnabled()) {
    const result = await startSystemAudioCapture();
    systemAudioStatus = result.status;
    systemAudioReason = result.reason;
  }

  const stream = destination.stream.getAudioTracks().length
    ? destination.stream
    : micStream;
  return { stream, systemAudioStatus, systemAudioReason };
}

export function getAutoCaptureState() {
  return activeState;
}

export function subscribeAutoCapture(
  listener: (state: AutoCaptureState | null) => void,
) {
  listeners.add(listener);
  listener(activeState);
  return () => {
    listeners.delete(listener);
  };
}

export function subscribeAutoCaptureStop(
  listener: (event: AutoCaptureStopEvent) => void,
) {
  stopListeners.add(listener);
  return () => {
    stopListeners.delete(listener);
  };
}

export function getMeetingDetectedNotice() {
  return lastDetectedNotice;
}

export function subscribeMeetingDetectedNotice(
  listener: (notice: MeetingDetectedNotice | null) => void,
) {
  noticeListeners.add(listener);
  listener(lastDetectedNotice);
  return () => {
    noticeListeners.delete(listener);
  };
}

export function hasAutoStartedForCalendarEvent(eventId: string) {
  return calendarAutoStarted.has(eventId);
}

export function shouldAutoStartForCalendarEvent(startTime: string) {
  const startMs = new Date(startTime).getTime();
  if (!Number.isFinite(startMs)) {
    return false;
  }
  const diff = Math.abs(Date.now() - startMs);
  return diff <= CALENDAR_AUTO_WINDOW_MS;
}

export async function startAutoCapture(input: StartCaptureInput) {
  if (
    activeState?.meetingId === input.meetingId &&
    activeState.status !== "stopping"
  ) {
    return activeState;
  }

  if (activeState) {
    await stopAutoCapture("replaced");
  }

  const sourceApp = detectSourceApp(input);
  const expectsMeetingSignal =
    input.trigger === "calendar" || !!input.joinUrl;
  activeState = {
    meetingId: input.meetingId,
    title: input.title,
    sourceApp,
    trigger: input.trigger,
    startedAt: Date.now(),
    status: "starting",
    expectsMeetingSignal,
    systemAudioStatus: "disabled",
  };
  lastDetectedNotice = {
    meetingId: input.meetingId,
    title: input.title,
    sourceApp,
    trigger: input.trigger,
    detectedAt: Date.now(),
  };
  emitNotice();
  emitState();

  // Create meeting record on the backend so transcripts, notes, and speaker
  // resolution are associated correctly.  Use the server-generated _id as
  // the canonical meetingId for all subsequent operations.
  try {
    const meeting = await startMeeting({
      title: input.title,
      source: input.trigger === "calendar" ? "calendar" : "manual",
      calendarEventId: input.calendarEventId,
    });
    if (meeting?._id) {
      activeState = { ...activeState, meetingId: meeting._id };
    }
  } catch {
    // Meeting record creation is best-effort; capture still proceeds
    // with the client-generated meetingId.
  }

  try {
    const { stream, systemAudioStatus, systemAudioReason } =
      await getMixedAudioStreams();
    stopInProgress = false;

    try {
      await startTranscriptStream(activeState.meetingId);
    } catch (error) {
      // Backend returns 503 with reason="deepgram_not_configured" when the
      // DEEPGRAM_API_KEY env var is missing. Abort the recording loudly
      // instead of letting the renderer push audio that goes nowhere.
      if (
        error instanceof ApiError &&
        (error.status === 503 || error.reason === "deepgram_not_configured")
      ) {
        throw new TranscriptionDisabledError(
          error.message ||
            "Transcription is disabled — DEEPGRAM_API_KEY not set on backend.",
        );
      }
      throw error;
    }
    streamingActive = true;
    consecutiveStreamFailures = 0;
    consecutiveReconnectFailures = 0;
    lastReconnectAttemptAt = 0;
    totalBytesStreamed = 0;
    resetStreamStats();
    resetLiveTranscript();
    if (systemAudioReason) {
      streamStats = { ...streamStats, systemAudioReason };
      emitStreamStats();
    }
    setupPcmStreaming(stream);

    setupSilenceDetection(stream);
    scheduleAutoStops(input.endTime);
    activeState = {
      ...activeState,
      status: "recording",
      systemAudioStatus,
    };
    emitState();
    return activeState;
  } catch (error) {
    await stopAutoCapture("manual");
    throw error;
  }
}

function setupPcmStreaming(stream: MediaStream) {
  if (!audioContext) {
    return;
  }

  // ScriptProcessorNode to capture raw PCM samples at 16kHz
  const source = audioContext.createMediaStreamSource(stream);
  // Buffer size 4096 at whatever sample rate, we'll downsample to 16kHz
  scriptProcessorNode = audioContext.createScriptProcessor(4096, 1, 1);
  const nativeSampleRate = audioContext.sampleRate;
  const targetSampleRate = 16000;

  scriptProcessorNode.onaudioprocess = (event) => {
    const inputData = event.inputBuffer.getChannelData(0);
    // Downsample to 16kHz
    const ratio = nativeSampleRate / targetSampleRate;
    const outputLength = Math.floor(inputData.length / ratio);
    const output = new Int16Array(outputLength);
    for (let i = 0; i < outputLength; i += 1) {
      const sample = inputData[Math.floor(i * ratio)] ?? 0;
      // Convert float32 [-1, 1] to int16 [-32768, 32767]
      output[i] = Math.max(-32768, Math.min(32767, Math.round(sample * 32767)));
    }
    pcmBuffer.push(output);
  };

  source.connect(scriptProcessorNode);
  // Connect to destination to keep the processor alive (won't produce audible output)
  scriptProcessorNode.connect(audioContext.destination);

  // Periodically flush PCM buffer to backend. Mic PCM comes from the
  // ScriptProcessorNode above (16 kHz Int16 mono). System-audio PCM
  // arrives via IPC from AudioTee at the same sample rate and is
  // buffered in sysAudioBuffer. We mix them by element-wise add + clamp
  // into a single Int16 stream before sending — Deepgram sees one mixed
  // mono track containing both the user and other participants.
  pcmStreamTimer = window.setInterval(() => {
    if ((!pcmBuffer.length && !sysAudioBuffer.length) || !activeState) {
      return;
    }
    const micTotal = pcmBuffer.reduce((sum, buf) => sum + buf.length, 0);
    const micFlat = new Int16Array(micTotal);
    let micOffset = 0;
    for (const buf of pcmBuffer) {
      micFlat.set(buf, micOffset);
      micOffset += buf.length;
    }
    pcmBuffer = [];

    const sysTotal = sysAudioBuffer.reduce((sum, buf) => sum + buf.length, 0);
    const sysFlat = new Int16Array(sysTotal);
    let sysOffset = 0;
    for (const buf of sysAudioBuffer) {
      sysFlat.set(buf, sysOffset);
      sysOffset += buf.length;
    }
    sysAudioBuffer = [];

    // Take the shorter length as the mix window; whatever's left over in
    // the longer buffer we tack on un-mixed so no audio is dropped. Mic
    // track (user's voice) and system track (others' voices) never share
    // content — speakers don't play back the mic — so a straight additive
    // mix has no risk of double-counting.
    const mixLen = Math.min(micFlat.length, sysFlat.length);
    const tailLen = Math.max(micFlat.length, sysFlat.length) - mixLen;
    const totalLength = mixLen + tailLen;
    const merged = new Int16Array(totalLength);
    for (let i = 0; i < mixLen; i += 1) {
      const summed = (micFlat[i] ?? 0) + (sysFlat[i] ?? 0);
      merged[i] = Math.max(-32768, Math.min(32767, summed));
    }
    if (tailLen > 0) {
      const tailSrc = micFlat.length > sysFlat.length ? micFlat : sysFlat;
      for (let i = 0; i < tailLen; i += 1) {
        merged[mixLen + i] = tailSrc[mixLen + i] ?? 0;
      }
    }

    const blob = new Blob([merged.buffer], {
      type: "application/octet-stream",
    });
    const currentMeetingId = activeState.meetingId;
    void sendStreamAudio(currentMeetingId, blob)
      .then((response) => {
        consecutiveStreamFailures = 0;
        consecutiveReconnectFailures = 0;
        totalBytesStreamed += merged.byteLength;
        const health = response?.health;
        // Append any finalized segments Deepgram produced since the last
        // send. The backend drains its per-session buffer on every
        // response, so `response.segments` is at most a handful of rows.
        // We append and emit; QuickNotePage renders them live under the
        // notes textarea.
        if (response?.segments?.length) {
          liveTranscript = [...liveTranscript, ...response.segments];
          emitLiveTranscript();
        }
        // The backend may report accepted=false with a session-recycle reason
        // even on HTTP 200. Surface that without flipping into the catch
        // branch — the renderer keeps sending and the backend transparently
        // re-opens. Only the visible health stats need to update.
        const backendReason =
          response && response.accepted === false ? response.reason ?? null : null;
        streamStats = {
          ...streamStats,
          bytesStreamed: totalBytesStreamed,
          consecutiveFailures: 0,
          consecutiveReconnects: 0,
          segmentsAccepted: health?.segmentsInserted ?? streamStats.segmentsAccepted,
          segmentsDropped: health?.segmentsDropped ?? streamStats.segmentsDropped,
          lastBackendError:
            health?.lastError ??
            (backendReason ? `backend: ${backendReason}` : streamStats.lastBackendError),
        };
        emitStreamStats();
      })
      .catch((error) => {
        consecutiveStreamFailures += 1;
        const errMsg =
          error instanceof Error ? error.message : String(error);
        console.warn(
          `[brifo][auto-capture] Stream audio send failed (${consecutiveStreamFailures}/${MAX_STREAM_FAILURES}):`,
          errMsg,
        );
        streamStats = {
          ...streamStats,
          consecutiveFailures: consecutiveStreamFailures,
          lastError: errMsg,
        };
        emitStreamStats();

        // Proactively try to re-open the streaming session on the backend.
        // Throttled by cooldown and capped at MAX_RECONNECT_ATTEMPTS so a
        // permanently broken backend (bad auth, network outage) fails fast
        // instead of retrying forever.
        const now = Date.now();
        if (
          activeState &&
          activeState.status === "recording" &&
          now - lastReconnectAttemptAt >= STREAM_RECONNECT_COOLDOWN_MS &&
          consecutiveReconnectFailures < MAX_RECONNECT_ATTEMPTS
        ) {
          lastReconnectAttemptAt = now;
          const reconnectMeetingId = currentMeetingId;
          console.log(
            `[brifo][auto-capture] Attempting to re-open streaming session (${consecutiveReconnectFailures + 1}/${MAX_RECONNECT_ATTEMPTS})...`,
          );
          void startTranscriptStream(reconnectMeetingId)
            .then(() => {
              console.log(
                "[brifo][auto-capture] Stream reopened successfully.",
              );
              consecutiveStreamFailures = 0;
              consecutiveReconnectFailures = 0;
              streamStats = {
                ...streamStats,
                consecutiveFailures: 0,
                consecutiveReconnects: 0,
              };
              emitStreamStats();
            })
            .catch((reopenError) => {
              consecutiveReconnectFailures += 1;
              const reopenMsg =
                reopenError instanceof Error
                  ? reopenError.message
                  : String(reopenError);
              console.warn(
                `[brifo][auto-capture] Stream reopen failed (${consecutiveReconnectFailures}/${MAX_RECONNECT_ATTEMPTS}):`,
                reopenMsg,
              );
              streamStats = {
                ...streamStats,
                consecutiveReconnects: consecutiveReconnectFailures,
                lastError: reopenMsg,
              };
              emitStreamStats();
            });
        }

        const reconnectsExhausted =
          consecutiveReconnectFailures >= MAX_RECONNECT_ATTEMPTS;
        if (
          (consecutiveStreamFailures >= MAX_STREAM_FAILURES ||
            reconnectsExhausted) &&
          activeState &&
          activeState.status === "recording"
        ) {
          console.error(
            reconnectsExhausted
              ? `[brifo][auto-capture] Reconnect attempts exhausted (${MAX_RECONNECT_ATTEMPTS}) — stopping capture.`
              : "[brifo][auto-capture] Stream broken after repeated failures — stopping capture.",
          );
          void stopAutoCapture("stream_failed");
        }
      });
  }, STREAM_INTERVAL_MS);

  // Periodic health heartbeat
  const healthTimer = window.setInterval(() => {
    if (!activeState || activeState.status !== "recording") {
      window.clearInterval(healthTimer);
      return;
    }
    console.log(
      `[brifo][stream] health: ${totalBytesStreamed} bytes sent, ${consecutiveStreamFailures} consecutive failures`,
    );
  }, 5000);
}

export async function stopAutoCapture(reason: StopReason = "manual") {
  if (!activeState || stopInProgress) {
    return;
  }

  const stoppedMeetingId = activeState.meetingId;
  const stoppedTitle = activeState.title;

  stopInProgress = true;
  activeState = { ...activeState, status: "stopping" };
  emitState();

  console.log(
    `[brifo][auto-capture] stopAutoCapture(reason=${reason}) totalBytesStreamed=${totalBytesStreamed}`,
  );

  try {
    // Step 1: stop the PCM flush timer so no more audio is sent
    if (pcmStreamTimer !== null) {
      try {
        window.clearInterval(pcmStreamTimer);
      } catch {
        // ignore
      }
      pcmStreamTimer = null;
    }

    // Step 2: disconnect the ScriptProcessorNode
    if (scriptProcessorNode) {
      try {
        scriptProcessorNode.disconnect();
      } catch {
        // ignore
      }
      scriptProcessorNode = null;
    }
    pcmBuffer = [];

    // Step 2b: stop the AudioTee Swift subprocess and clear its PCM buffer.
    // Must happen before stopAllTracks so no new system-audio chunks arrive
    // into a half-torn-down state.
    try {
      await stopSystemAudioCapture();
    } catch {
      // ignore
    }

    // Step 3: tell the backend to close the Deepgram session
    if (streamingActive) {
      try {
        await stopTranscriptStream(stoppedMeetingId);
      } catch (error) {
        console.warn(
          "[brifo][auto-capture] stopTranscriptStream failed:",
          error instanceof Error ? error.message : error,
        );
      }
      streamingActive = false;
    }

    // Step 4: clear silence/auto-stop timers
    try {
      clearTimers();
    } catch {
      // ignore
    }

    // Step 6: STOP ALL TRACKS FIRST — this releases the OS-level mic lock
    // (so the macOS mic indicator turns off immediately). AudioContext
    // close comes afterwards.
    try {
      stopAllTracks(micStream);
    } catch {
      // ignore
    }

    // Step 7: close the AudioContext now that all sources are released
    if (audioContext) {
      try {
        await audioContext.close();
      } catch {
        // ignore
      }
    }

    // Step 8: tell the backend the meeting ended (triggers speaker resolution)
    try {
      await stopMeeting(stoppedMeetingId);
    } catch (error) {
      console.warn(
        "[brifo][auto-capture] stopMeeting failed (non-fatal):",
        error instanceof Error ? error.message : error,
      );
    }
  } finally {
    // ALWAYS null state so we never end up with zombie references, even if
    // one of the cleanup steps above threw.
    micStream = null;
    audioContext = null;
    analyserNode = null;
    consecutiveStreamFailures = 0;
    consecutiveReconnectFailures = 0;
    lastReconnectAttemptAt = 0;
    // NOTE: we do NOT reset totalBytesStreamed / streamStats here. The
    // finalize step (waitForTranscriptStability) reads bytesStreamed to
    // decide how long to wait for the backend to drain Deepgram's final
    // results — if we zero it here, finalize would always think no audio
    // was captured and bail early. The next startAutoCapture() resets
    // everything via resetStreamStats() before recording resumes.

    activeState = null;
    stopInProgress = false;
    emitState();
  }

  // Emit stop event so background finalizer can generate document & tasks
  const stopEvent: AutoCaptureStopEvent = {
    meetingId: stoppedMeetingId,
    title: stoppedTitle,
    reason,
  };
  for (const cb of stopListeners) {
    try {
      cb(stopEvent);
    } catch (error) {
      console.error(
        "[brifo][auto-capture] stop listener threw:",
        error instanceof Error ? error.message : error,
      );
    }
  }
}

export async function autoStartCaptureForCalendarEvent(event: {
  id: string;
  title: string;
  startTime: string;
  endTime?: string | null;
  joinUrl?: string | null;
}) {
  if (calendarAutoStarted.has(event.id)) {
    return;
  }

  calendarAutoStarted.add(event.id);
  try {
    await startAutoCapture({
      meetingId: event.id,
      title: event.title,
      trigger: "calendar",
      endTime: event.endTime ?? null,
      joinUrl: event.joinUrl ?? null,
      calendarEventId: event.id,
    });
  } catch (error) {
    console.error("Calendar auto-start capture failed", error);
  }
}
