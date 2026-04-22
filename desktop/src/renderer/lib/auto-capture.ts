import {
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
const MAX_DURATION_MS = 10 * 60 * 60 * 1000;
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
let lastReconnectAttemptAt = 0;

const listeners = new Set<(state: AutoCaptureState | null) => void>();
const noticeListeners = new Set<
  (notice: MeetingDetectedNotice | null) => void
>();
const stopListeners = new Set<(event: AutoCaptureStopEvent) => void>();
const calendarAutoStarted = new Set<string>();

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

function isPermissionRelated(message: string): boolean {
  return (
    message.includes("notallowederror") ||
    message.includes("permission") ||
    message.includes("denied")
  );
}

function buildCaptureStartError(micError: unknown): Error {
  const micMessage = getErrorMessage(micError).toLowerCase();

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

  return new Error(
    "Unable to start capturing. Check microphone permissions and try again.",
  );
}

async function ensureMicrophonePermission(): Promise<void> {
  // First, try to trigger the native macOS permission dialog via the main process.
  // This helps register the app in System Settings, but the renderer (Chromium)
  // ultimately handles getUserMedia permissions separately.
  try {
    const permissions = await window.electronAPI.checkPermissions();
    if (permissions.microphone === "not-determined") {
      await window.electronAPI.requestMicrophoneAccess();
    }
  } catch {
    // electronAPI may be unavailable in non-Electron environments
  }

  // The real permission check: attempt a quick getUserMedia call.
  // This is what actually triggers the macOS native prompt for the renderer
  // and registers the app in System Settings > Microphone.
  try {
    const testStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
    });
    testStream.getTracks().forEach((track) => track.stop());
  } catch (error) {
    const message = getErrorMessage(error).toLowerCase();
    if (isPermissionRelated(message)) {
      throw new PermissionError(
        "Microphone access is required. Please grant Brifo microphone permission in System Settings and try again.",
      );
    }
    // For non-permission errors (e.g. no mic hardware), let getMixedAudioStreams handle it
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
    if (rms > 0.015) {
      lastAudioDetectedAt = Date.now();
      return;
    }

    if (Date.now() - lastAudioDetectedAt > SILENCE_STOP_MS) {
      void stopAutoCapture("silence");
    }
  }, SILENCE_SAMPLE_MS);
}

async function getMixedAudioStreams() {
  await ensureMicrophonePermission();

  try {
    micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
      },
    });
  } catch (error) {
    micStream = null;
    throw buildCaptureStartError(error);
  }

  if (!micStream || !micStream.getAudioTracks().length) {
    throw buildCaptureStartError(new Error("No microphone track available."));
  }

  // Route the raw mic stream through an AudioContext so downstream code
  // (analyser for silence detection, PCM streaming) has a consistent
  // MediaStream reference to work with. We don't mix in any other
  // source — Brifo captures the microphone only, by design.
  audioContext = new AudioContext();
  const destination = audioContext.createMediaStreamDestination();
  const micSource = audioContext.createMediaStreamSource(
    new MediaStream(micStream.getAudioTracks()),
  );
  micSource.connect(destination);

  return destination.stream.getAudioTracks().length
    ? destination.stream
    : micStream;
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
    const stream = await getMixedAudioStreams();
    stopInProgress = false;

    await startTranscriptStream(activeState.meetingId);
    streamingActive = true;
    consecutiveStreamFailures = 0;
    totalBytesStreamed = 0;
    setupPcmStreaming(stream);

    setupSilenceDetection(stream);
    scheduleAutoStops(input.endTime);
    activeState = {
      ...activeState,
      status: "recording",
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

  // Periodically flush PCM buffer to backend
  pcmStreamTimer = window.setInterval(() => {
    if (!pcmBuffer.length || !activeState) {
      return;
    }
    const totalLength = pcmBuffer.reduce((sum, buf) => sum + buf.length, 0);
    const merged = new Int16Array(totalLength);
    let offset = 0;
    for (const buf of pcmBuffer) {
      merged.set(buf, offset);
      offset += buf.length;
    }
    pcmBuffer = [];

    const blob = new Blob([merged.buffer], {
      type: "application/octet-stream",
    });
    const currentMeetingId = activeState.meetingId;
    void sendStreamAudio(currentMeetingId, blob)
      .then(() => {
        consecutiveStreamFailures = 0;
        totalBytesStreamed += merged.byteLength;
      })
      .catch((error) => {
        consecutiveStreamFailures += 1;
        console.warn(
          `[brifo][auto-capture] Stream audio send failed (${consecutiveStreamFailures}/${MAX_STREAM_FAILURES}):`,
          error instanceof Error ? error.message : error,
        );

        // Proactively try to re-open the streaming session on the backend.
        // Throttled so a burst of failures produces at most one reconnect
        // attempt per cooldown window.
        const now = Date.now();
        if (
          activeState &&
          activeState.status === "recording" &&
          now - lastReconnectAttemptAt >= STREAM_RECONNECT_COOLDOWN_MS
        ) {
          lastReconnectAttemptAt = now;
          const reconnectMeetingId = currentMeetingId;
          console.log(
            "[brifo][auto-capture] Attempting to re-open streaming session...",
          );
          void startTranscriptStream(reconnectMeetingId)
            .then(() => {
              console.log(
                "[brifo][auto-capture] Stream reopened successfully.",
              );
              consecutiveStreamFailures = 0;
            })
            .catch((reopenError) => {
              console.warn(
                "[brifo][auto-capture] Stream reopen failed:",
                reopenError instanceof Error
                  ? reopenError.message
                  : reopenError,
              );
            });
        }

        if (
          consecutiveStreamFailures >= MAX_STREAM_FAILURES &&
          activeState &&
          activeState.status === "recording"
        ) {
          console.error(
            "[brifo][auto-capture] Stream broken after repeated failures — stopping capture.",
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
    totalBytesStreamed = 0;

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
