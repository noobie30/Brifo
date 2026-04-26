import { Injectable, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { ConfigService } from "@nestjs/config";
import { Model } from "mongoose";
import WebSocket from "ws";
import {
  TranscriptSegment,
  TranscriptSegmentDocument,
} from "./schemas/transcript-segment.schema";
import { Meeting, MeetingDocument } from "../meetings/schemas/meeting.schema";

interface DeepgramWord {
  word?: string;
  start?: number;
  end?: number;
  confidence?: number;
  speaker?: number;
}

interface DeepgramAlternative {
  transcript?: string;
  confidence?: number;
  words?: DeepgramWord[];
}

interface DeepgramResult {
  is_final?: boolean;
  channel?: {
    alternatives?: DeepgramAlternative[];
  };
  start?: number;
  duration?: number;
}

interface StreamingSession {
  meetingId: string;
  userId: string;
  ws: WebSocket;
  startedAt: number;
  segmentCount: number;
  // Number of segments Deepgram returned that we tried to persist but
  // couldn't (Mongo write failed after retries). Non-zero means the
  // backend is silently losing transcript data — surface this to the
  // renderer so the user knows their recording is not landing.
  dropCount: number;
  lastError: string | null;
  // Offset (ms) to add to Deepgram-relative timestamps so segments line up
  // with the wall-clock meeting start. Non-zero when this session was
  // re-opened mid-meeting after a Vercel instance recycle.
  timeOffsetMs: number;
  // New segments produced by Deepgram since the last drain. Flushed out
  // on every /transcript/stream/audio response so the renderer can show
  // a live transcript in the Quick Note text area without any new
  // endpoint or polling.
  pendingLive: LiveSegment[];
}

export interface LiveSegment {
  speakerLabel: string;
  text: string;
  startMs: number;
  endMs: number;
}

export interface SessionHealth {
  segmentsInserted: number;
  segmentsDropped: number;
  lastError: string | null;
}

export type SendAudioResult =
  | { ok: true; health: SessionHealth; segments: LiveSegment[] }
  | {
      ok: false;
      reason: "reopen_failed" | "session_not_open" | "send_failed";
      message?: string;
      health: SessionHealth;
      segments: LiveSegment[];
    };

const EMPTY_HEALTH: SessionHealth = {
  segmentsInserted: 0,
  segmentsDropped: 0,
  lastError: null,
};

function snapshotHealth(session: StreamingSession): SessionHealth {
  return {
    segmentsInserted: session.segmentCount,
    segmentsDropped: session.dropCount,
    lastError: session.lastError,
  };
}

@Injectable()
export class DeepgramStreamingService {
  private readonly logger = new Logger(DeepgramStreamingService.name);
  private readonly activeSessions = new Map<string, StreamingSession>();
  private readonly apiKey: string;
  private readonly connectTimeoutMs: number;

  constructor(
    @InjectModel(TranscriptSegment.name)
    private readonly transcriptModel: Model<TranscriptSegmentDocument>,
    @InjectModel(Meeting.name)
    private readonly meetingModel: Model<MeetingDocument>,
    private readonly configService: ConfigService,
  ) {
    this.apiKey =
      this.configService.get<string>("DEEPGRAM_API_KEY")?.trim() ?? "";
    const rawTimeout = this.configService.get<string | number>(
      "DEEPGRAM_CONNECT_TIMEOUT_MS",
    );
    const parsedTimeout =
      typeof rawTimeout === "number"
        ? rawTimeout
        : Number.parseInt(String(rawTimeout ?? ""), 10);
    this.connectTimeoutMs =
      Number.isFinite(parsedTimeout) && parsedTimeout > 0
        ? parsedTimeout
        : 10_000;
  }

  isConfigured(): boolean {
    return this.apiKey.length > 0;
  }

  // Retry a Mongo write with exponential backoff. Used for transcript inserts
  // so a transient DB blip (replica set election, brief network hiccup)
  // doesn't silently drop segments.
  private async retryWrite<T>(
    operation: () => Promise<T>,
    label: string,
    maxAttempts = 3,
  ): Promise<T | null> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        if (attempt < maxAttempts) {
          const delayMs = 100 * 2 ** (attempt - 1);
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }
    }
    this.logger.error(
      `${label} failed after ${maxAttempts} attempts: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
    );
    return null;
  }

  async startSession(
    userId: string,
    meetingId: string,
  ): Promise<{ sessionId: string }> {
    if (!this.apiKey) {
      throw new Error(
        "Deepgram is not configured. Add DEEPGRAM_API_KEY in API env.",
      );
    }

    const sessionId = `${userId}:${meetingId}`;
    if (this.activeSessions.has(sessionId)) {
      return { sessionId };
    }

    // If this is a recovery re-open (meeting already running, previous
    // session was lost with the Vercel instance), offset Deepgram-relative
    // timestamps so new segments line up with wall-clock meeting time.
    let timeOffsetMs = 0;
    try {
      const meeting = await this.meetingModel
        .findOne({ _id: meetingId, userId })
        .exec();
      if (meeting?.startTime) {
        const startedAtMs = new Date(meeting.startTime).getTime();
        if (Number.isFinite(startedAtMs)) {
          timeOffsetMs = Math.max(0, Date.now() - startedAtMs);
        }
      }
    } catch (error) {
      this.logger.warn(
        `Could not read meeting startTime for ${meetingId} (offset=0): ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    const params = new URLSearchParams({
      model: "nova-3",
      language: "multi",
      smart_format: "true",
      diarize: "true",
      encoding: "linear16",
      sample_rate: "16000",
      channels: "1",
      // Deepgram rejects the handshake with HTTP 400
      // "Utterance End feature requires interim results" when
      // utterance_end_ms is set but interim_results is false. handleMessage
      // early-returns on !data.is_final, so enabling interim results adds
      // no observable behavior — it only makes Deepgram accept the config.
      interim_results: "true",
      utterance_end_ms: "1500",
      vad_events: "true",
    });

    const ws = new WebSocket(
      `wss://api.deepgram.com/v1/listen?${params.toString()}`,
      { headers: { Authorization: `Token ${this.apiKey}` } },
    );

    const session: StreamingSession = {
      meetingId,
      userId,
      ws,
      startedAt: Date.now(),
      segmentCount: 0,
      dropCount: 0,
      lastError: null,
      timeOffsetMs,
      pendingLive: [],
    };

    if (timeOffsetMs > 0) {
      this.logger.log(
        `Deepgram session recovered for ${meetingId} (offset=${Math.round(timeOffsetMs / 1000)}s)`,
      );
    }

    ws.on("open", () => {
      this.logger.log(`Deepgram WebSocket opened for ${meetingId}`);
    });

    ws.on("message", (raw: Buffer) => {
      this.handleMessage(session, raw).catch((error) => {
        this.logger.error(
          `handleMessage rejected for ${meetingId}: ${error instanceof Error ? error.message : String(error)}`,
        );
      });
    });

    ws.on("error", (error) => {
      this.logger.error(`Deepgram WS error for ${meetingId}: ${error.message}`);
    });

    ws.on("close", () => {
      this.logger.log(
        `Deepgram WS closed for ${meetingId} (${session.segmentCount} segments)`,
      );
      this.activeSessions.delete(sessionId);
    });

    // Wait for connection to open
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(
        () =>
          reject(
            new Error(
              `Deepgram connection timeout after ${this.connectTimeoutMs}ms`,
            ),
          ),
        this.connectTimeoutMs,
      );
      ws.once("open", () => {
        clearTimeout(timeout);
        resolve();
      });
      ws.once("error", (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });

    this.activeSessions.set(sessionId, session);
    return { sessionId };
  }

  private async handleMessage(
    session: StreamingSession,
    raw: Buffer,
  ): Promise<void> {
    let data: DeepgramResult;
    try {
      data = JSON.parse(raw.toString()) as DeepgramResult;
    } catch (parseError) {
      const preview = raw.toString().slice(0, 200);
      const msg = `Deepgram payload JSON parse failed (${raw.length}B): ${preview}`;
      session.lastError = msg;
      this.logger.warn(`[${session.meetingId}] ${msg}`);
      return;
    }

    if (!data.is_final) {
      return;
    }

    const alternatives = data.channel?.alternatives;
    if (!alternatives?.length) {
      this.logger.debug(
        `[${session.meetingId}] is_final result with no alternatives — skipping`,
      );
      return;
    }

    const best = alternatives[0];
    const transcript = best.transcript?.trim();
    if (!transcript) {
      this.logger.debug(
        `[${session.meetingId}] is_final result with empty transcript (confidence=${best.confidence ?? "n/a"}, words=${best.words?.length ?? 0}) — skipping`,
      );
      return;
    }

    const words = best.words ?? [];
    const { meetingId, userId, timeOffsetMs } = session;

    if (!words.length) {
      const startMs = Math.round((data.start ?? 0) * 1000) + timeOffsetMs;
      const endMs =
        Math.round(((data.start ?? 0) + (data.duration ?? 0)) * 1000) +
        timeOffsetMs;
      const inserted = await this.retryWrite(
        () =>
          this.transcriptModel.create({
            meetingId,
            userId,
            speakerLabel: "Speaker A",
            speakerRole: "unknown",
            startMs,
            endMs,
            text: transcript,
            confidence: best.confidence ?? undefined,
            captureSource: "auto",
          }),
        `insert non-diarized segment for ${meetingId}`,
      );
      if (inserted) {
        session.segmentCount += 1;
        session.pendingLive.push({
          speakerLabel: "Speaker A",
          text: transcript,
          startMs,
          endMs,
        });
      } else {
        session.dropCount += 1;
        const preview = transcript.slice(0, 80);
        const msg = `dropped non-diarized segment after retries: "${preview}"`;
        session.lastError = msg;
        this.logger.error(`[${meetingId}] ${msg}`);
      }
      return;
    }

    // Group words by speaker for diarized segments
    const segments: Array<{
      speaker: string;
      text: string;
      startMs: number;
      endMs: number;
      confidence: number;
    }> = [];

    let currentSpeaker = String(words[0].speaker ?? 0);
    let currentWords: string[] = [words[0].word ?? ""];
    let segStartMs = Math.round((words[0].start ?? 0) * 1000) + timeOffsetMs;
    let segEndMs = Math.round((words[0].end ?? 0) * 1000) + timeOffsetMs;
    let totalConf = words[0].confidence ?? 0;
    let wordCount = 1;

    for (let i = 1; i < words.length; i += 1) {
      const w = words[i];
      const speaker = String(w.speaker ?? currentSpeaker);
      if (speaker !== currentSpeaker) {
        segments.push({
          speaker: `Speaker ${currentSpeaker}`,
          text: currentWords.join(" "),
          startMs: segStartMs,
          endMs: segEndMs,
          confidence: totalConf / wordCount,
        });
        currentSpeaker = speaker;
        currentWords = [];
        segStartMs = Math.round((w.start ?? 0) * 1000) + timeOffsetMs;
        totalConf = 0;
        wordCount = 0;
      }
      currentWords.push(w.word ?? "");
      segEndMs = Math.round((w.end ?? 0) * 1000) + timeOffsetMs;
      totalConf += w.confidence ?? 0;
      wordCount += 1;
    }

    if (currentWords.length) {
      segments.push({
        speaker: `Speaker ${currentSpeaker}`,
        text: currentWords.join(" "),
        startMs: segStartMs,
        endMs: segEndMs,
        confidence: totalConf / wordCount,
      });
    }

    if (segments.length) {
      const inserted = await this.retryWrite(
        () =>
          this.transcriptModel.insertMany(
            segments.map((seg) => ({
              meetingId,
              userId,
              speakerLabel: seg.speaker,
              speakerRole: "unknown" as const,
              startMs: seg.startMs,
              endMs: seg.endMs,
              text: seg.text,
              confidence: seg.confidence,
              captureSource: "auto" as const,
            })),
          ),
        `insertMany diarized segments for ${meetingId}`,
      );
      if (inserted) {
        session.segmentCount += segments.length;
        for (const seg of segments) {
          session.pendingLive.push({
            speakerLabel: seg.speaker,
            text: seg.text,
            startMs: seg.startMs,
            endMs: seg.endMs,
          });
        }
      } else {
        session.dropCount += segments.length;
        const preview = segments[0].text.slice(0, 80);
        const msg = `dropped ${segments.length} diarized segments after retries (first: "${preview}")`;
        session.lastError = msg;
        this.logger.error(`[${meetingId}] ${msg}`);
      }
    }
  }

  async sendAudio(
    userId: string,
    meetingId: string,
    audio: Buffer,
  ): Promise<SendAudioResult> {
    const sessionId = `${userId}:${meetingId}`;
    let session = this.activeSessions.get(sessionId);

    // Vercel instance recycle: previous session is gone from memory.
    // Transparently re-open the Deepgram WebSocket so capture survives.
    if (!session || session.ws.readyState !== WebSocket.OPEN) {
      if (session && session.ws.readyState !== WebSocket.OPEN) {
        this.logger.warn(
          `WebSocket not open for ${meetingId} (state=${session.ws.readyState}); re-opening.`,
        );
        this.activeSessions.delete(sessionId);
      } else {
        this.logger.log(
          `No active session for ${meetingId}; re-opening Deepgram stream (instance recycle).`,
        );
      }
      try {
        await this.startSession(userId, meetingId);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(
          `Failed to re-open Deepgram session for ${meetingId}: ${message}`,
        );
        const recovered = this.activeSessions.get(sessionId);
        return {
          ok: false,
          reason: "reopen_failed",
          message,
          health: recovered
            ? snapshotHealth(recovered)
            : { ...EMPTY_HEALTH, lastError: message },
          segments: [],
        };
      }
      session = this.activeSessions.get(sessionId);
      if (!session || session.ws.readyState !== WebSocket.OPEN) {
        return {
          ok: false,
          reason: "session_not_open",
          health: session ? snapshotHealth(session) : EMPTY_HEALTH,
          segments: [],
        };
      }
    }

    try {
      session.ws.send(audio);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`ws.send threw for ${meetingId}: ${message}`);
      session.lastError = message;
      // Drain any segments Deepgram already produced before the send
      // failure, so the renderer doesn't miss them on the way to the
      // reconnect path.
      const drained = session.pendingLive;
      session.pendingLive = [];
      return {
        ok: false,
        reason: "send_failed",
        message,
        health: snapshotHealth(session),
        segments: drained,
      };
    }
    // Drain whatever finalized segments have accumulated since the last
    // send. Deepgram is asynchronous — it may have emitted several
    // is_final messages between our 250 ms audio posts. Handing them
    // back in this response lets the renderer stream them to the UI
    // without any new endpoint or websocket.
    const drained = session.pendingLive;
    session.pendingLive = [];
    return { ok: true, health: snapshotHealth(session), segments: drained };
  }

  async stopSession(userId: string, meetingId: string): Promise<SessionHealth> {
    const sessionId = `${userId}:${meetingId}`;
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      return EMPTY_HEALTH;
    }

    try {
      if (session.ws.readyState === WebSocket.OPEN) {
        // Send close message to Deepgram
        session.ws.send(JSON.stringify({ type: "CloseStream" }));
        // Wait briefly for final results
        await new Promise((resolve) => setTimeout(resolve, 2000));
        session.ws.close();
      }
    } catch {
      // Connection may already be closed
    }

    const health = snapshotHealth(session);
    this.activeSessions.delete(sessionId);
    this.logger.log(
      `Deepgram session stopped for ${meetingId} (${health.segmentsInserted} segments, ${health.segmentsDropped} dropped)`,
    );
    return health;
  }
}
