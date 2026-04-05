import { appendAutoTranscriptChunk } from "./api";

type CaptureTrigger = "join" | "calendar";
type StopReason =
  | "manual"
  | "silence"
  | "meeting_end"
  | "max_duration"
  | "replaced";

export interface AutoCaptureState {
  meetingId: string;
  title: string;
  sourceApp: string;
  trigger: CaptureTrigger;
  startedAt: number;
  status: "starting" | "recording" | "stopping";
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
}

const CHUNK_MS = 2 * 60 * 1000;
const SILENCE_STOP_MS = 8 * 60 * 1000;
const SILENCE_SAMPLE_MS = 2000;
const MAX_DURATION_MS = 10 * 60 * 60 * 1000;
const CALENDAR_AUTO_WINDOW_MS = 90 * 1000;

let activeState: AutoCaptureState | null = null;
let mediaRecorder: MediaRecorder | null = null;
let displayStream: MediaStream | null = null;
let micStream: MediaStream | null = null;
let mixedStream: MediaStream | null = null;
let audioContext: AudioContext | null = null;
let analyserNode: AnalyserNode | null = null;
let analyserTimer: number | null = null;
let endTimer: number | null = null;
let maxTimer: number | null = null;
let nextChunkStartMs = 0;
let chunkSequence = 0;
let lastAudioDetectedAt = 0;
let stopInProgress = false;

const uploadQueue = new Set<Promise<void>>();
const listeners = new Set<(state: AutoCaptureState | null) => void>();
const noticeListeners = new Set<
  (notice: MeetingDetectedNotice | null) => void
>();
const calendarAutoStarted = new Set<string>();
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
    window.electronAPI.setCaptureActive(!!activeState);
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

function makeMediaRecorder(stream: MediaStream): MediaRecorder {
  if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
    return new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
  }
  if (MediaRecorder.isTypeSupported("audio/webm")) {
    return new MediaRecorder(stream, { mimeType: "audio/webm" });
  }
  return new MediaRecorder(stream);
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

function buildCaptureStartError(
  displayError: unknown,
  micError: unknown,
): Error {
  const displayMessage = getErrorMessage(displayError).toLowerCase();
  const micMessage = getErrorMessage(micError).toLowerCase();
  const combined = `${displayMessage} ${micMessage}`.trim();

  if (isPermissionRelated(combined)) {
    return new PermissionError(
      "Microphone access is required. Please grant Brifo microphone permission in System Settings and try again.",
    );
  }

  if (
    combined.includes("not supported") ||
    combined.includes("notsupportederror")
  ) {
    return new Error(
      "This environment does not support audio capture. Brifo needs microphone permission to listen.",
    );
  }

  return new Error(
    "Unable to start listening. Check microphone permissions and try again.",
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

async function flushUploads() {
  if (!uploadQueue.size) {
    return;
  }
  await Promise.allSettled(Array.from(uploadQueue));
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

  let displayError: unknown = null;
  let micError: unknown = null;

  try {
    displayStream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: true,
    });
  } catch (error) {
    displayError = error;
    displayStream = null;
  }

  try {
    micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
      },
    });
  } catch (error) {
    micError = error;
    micStream = null;
  }

  if (!displayStream && !micStream) {
    throw buildCaptureStartError(displayError, micError);
  }

  audioContext = new AudioContext();
  const destination = audioContext.createMediaStreamDestination();

  const displayAudioTracks = displayStream?.getAudioTracks() ?? [];
  if (displayAudioTracks.length) {
    const displayAudioStream = new MediaStream(displayAudioTracks);
    const displaySource =
      audioContext.createMediaStreamSource(displayAudioStream);
    displaySource.connect(destination);
  }

  const micAudioTracks = micStream?.getAudioTracks() ?? [];
  if (micAudioTracks.length) {
    const micAudioStream = new MediaStream(micAudioTracks);
    const micSource = audioContext.createMediaStreamSource(micAudioStream);
    micSource.connect(destination);
  }

  mixedStream = destination.stream;
  if (!mixedStream.getAudioTracks().length) {
    const micTracks = micStream?.getAudioTracks() ?? [];
    if (micTracks.length) {
      mixedStream = new MediaStream(micTracks);
    } else {
      const displayTracks = displayStream?.getAudioTracks() ?? [];
      if (displayTracks.length) {
        mixedStream = new MediaStream(displayTracks);
      }
    }
  }

  if (!mixedStream.getAudioTracks().length) {
    throw buildCaptureStartError(displayError, micError);
  }

  return mixedStream;
}

async function uploadChunk(
  blob: Blob,
  meetingId: string,
  chunkStartMs: number,
  sequence: number,
) {
  const uploadPromise = appendAutoTranscriptChunk({
    meetingId,
    chunkStartMs,
    sequence,
    blob,
  })
    .then(() => {
      // no-op
    })
    .catch((error) => {
      console.error("Auto transcript chunk upload failed", error);
    })
    .finally(() => {
      uploadQueue.delete(uploadPromise);
    });

  uploadQueue.add(uploadPromise);
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
  activeState = {
    meetingId: input.meetingId,
    title: input.title,
    sourceApp,
    trigger: input.trigger,
    startedAt: Date.now(),
    status: "starting",
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

  try {
    const stream = await getMixedAudioStreams();
    mediaRecorder = makeMediaRecorder(stream);
    nextChunkStartMs = 0;
    chunkSequence = 0;
    stopInProgress = false;

    mediaRecorder.ondataavailable = (event) => {
      const blob = event.data;
      if (!blob || blob.size === 0 || !activeState) {
        return;
      }

      const chunkStart = nextChunkStartMs;
      const sequence = chunkSequence;
      chunkSequence += 1;
      nextChunkStartMs += CHUNK_MS;
      void uploadChunk(blob, activeState.meetingId, chunkStart, sequence);
    };

    mediaRecorder.start(CHUNK_MS);
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

export async function stopAutoCapture(_reason: StopReason = "manual") {
  if (!activeState || stopInProgress) {
    return;
  }

  stopInProgress = true;
  activeState = { ...activeState, status: "stopping" };
  emitState();

  try {
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      await new Promise<void>((resolve) => {
        const recorder = mediaRecorder;
        if (!recorder) {
          resolve();
          return;
        }
        recorder.onstop = () => resolve();
        recorder.stop();
      });
    }
  } catch {
    // ignore
  }

  clearTimers();

  if (audioContext) {
    try {
      await audioContext.close();
    } catch {
      // ignore
    }
  }

  stopAllTracks(displayStream);
  stopAllTracks(micStream);
  stopAllTracks(mixedStream);

  mediaRecorder = null;
  displayStream = null;
  micStream = null;
  mixedStream = null;
  audioContext = null;
  analyserNode = null;

  await flushUploads();

  activeState = null;
  stopInProgress = false;
  emitState();
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
    });
  } catch (error) {
    console.error("Calendar auto-start capture failed", error);
  }
}
