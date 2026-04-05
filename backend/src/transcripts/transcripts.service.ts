import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { ConfigService } from "@nestjs/config";
import { Model } from "mongoose";
import { google } from "googleapis";
import {
  TranscriptSegment,
  TranscriptSegmentDocument,
} from "./schemas/transcript-segment.schema";
import { UpsertTranscriptDto } from "./dto/upsert-transcript.dto";
import { UsersService } from "../users/users.service";

@Injectable()
export class TranscriptsService {
  private readonly logger = new Logger(TranscriptsService.name);
  private readonly assemblyApiBase = "https://api.assemblyai.com/v2";
  private readonly activeChunkJobs = new Set<string>();

  constructor(
    @InjectModel(TranscriptSegment.name)
    private readonly transcriptModel: Model<TranscriptSegmentDocument>,
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {}

  async appendSegments(
    userId: string,
    meetingId: string,
    payload: UpsertTranscriptDto,
  ): Promise<void> {
    if (!payload.segments.length) {
      return;
    }

    await this.transcriptModel.insertMany(
      payload.segments.map((segment) => ({
        meetingId,
        userId,
        ...segment,
        speakerRole: segment.speakerRole ?? "unknown",
        captureSource: "manual",
      })),
    );
  }

  async enqueueAutoTranscriptionChunk(params: {
    userId: string;
    meetingId: string;
    chunkStartMs: number;
    audioBuffer: Buffer;
    mimeType?: string;
    sequence?: number;
  }): Promise<void> {
    const { userId, meetingId, chunkStartMs, audioBuffer, mimeType, sequence } =
      params;
    if (!audioBuffer.length) {
      return;
    }

    const apiKey = this.configService.get<string>("ASSEMBLYAI_API_KEY")?.trim();
    if (!apiKey) {
      throw new BadRequestException(
        "AssemblyAI is not configured. Add ASSEMBLYAI_API_KEY in API env.",
      );
    }

    const jobKey = `${userId}:${meetingId}:${sequence ?? Date.now()}`;
    if (this.activeChunkJobs.has(jobKey)) {
      return;
    }
    this.activeChunkJobs.add(jobKey);

    void this.processAutoChunk({
      userId,
      meetingId,
      chunkStartMs,
      audioBuffer,
      mimeType,
      apiKey,
      jobKey,
    }).catch((error) => {
      this.logger.error(
        `Auto transcript chunk failed for ${meetingId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    });
  }

  async getSegments(
    userId: string,
    meetingId: string,
  ): Promise<TranscriptSegmentDocument[]> {
    return this.transcriptModel
      .find({ userId, meetingId })
      .sort({ startMs: 1 })
      .exec();
  }

  async getTranscribedMeetingsHistory(
    userId: string,
    limit = 20,
  ): Promise<
    Array<{
      meetingId: string;
      title: string;
      startTime: string;
      endTime: string | null;
      joinUrl: string | null;
      attendees: string[];
      transcriptSegments: number;
      firstTranscriptAt: string;
      lastTranscriptAt: string;
    }>
  > {
    const safeLimit = Math.max(
      1,
      Math.min(100, Number.isFinite(limit) ? limit : 20),
    );
    const rows = await this.transcriptModel
      .aggregate<{
        _id: string;
        transcriptSegments: number;
        firstTranscriptAt: Date;
        lastTranscriptAt: Date;
      }>([
        { $match: { userId, captureSource: "auto" } },
        {
          $group: {
            _id: "$meetingId",
            transcriptSegments: { $sum: 1 },
            firstTranscriptAt: { $min: "$createdAt" },
            lastTranscriptAt: { $max: "$createdAt" },
          },
        },
        { $sort: { lastTranscriptAt: -1 } },
        { $limit: safeLimit },
      ])
      .exec();

    if (!rows.length) {
      return [];
    }

    const calendar = await this.getCalendarClient(userId);

    const resolved = await Promise.all(
      rows.map(async (row) => {
        const googleEvent = calendar
          ? await this.resolveGoogleEvent(calendar, row._id).catch(() => null)
          : null;

        return {
          meetingId: row._id,
          title: googleEvent?.title ?? this.fallbackTitle(row._id),
          startTime:
            googleEvent?.startTime ??
            (row.lastTranscriptAt ?? row.firstTranscriptAt).toISOString(),
          endTime: googleEvent?.endTime ?? null,
          joinUrl: googleEvent?.joinUrl ?? null,
          attendees: googleEvent?.attendees ?? [],
          transcriptSegments: row.transcriptSegments,
          firstTranscriptAt: row.firstTranscriptAt.toISOString(),
          lastTranscriptAt: row.lastTranscriptAt.toISOString(),
        };
      }),
    );

    return resolved.sort(
      (a, b) =>
        new Date(b.lastTranscriptAt).getTime() -
        new Date(a.lastTranscriptAt).getTime(),
    );
  }

  private async getCalendarClient(
    userId: string,
  ): Promise<ReturnType<typeof google.calendar> | null> {
    const user = await this.usersService.findById(userId);
    const accessToken = user?.integrations?.googleCalendar?.accessToken;
    const refreshToken = user?.integrations?.googleCalendar?.refreshToken;
    if (!accessToken && !refreshToken) {
      return null;
    }

    const oauth2Client = new google.auth.OAuth2(
      this.configService.get<string>("GOOGLE_CLIENT_ID"),
      this.configService.get<string>("GOOGLE_CLIENT_SECRET"),
    );

    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
      expiry_date: user?.integrations?.googleCalendar?.expiryDate,
    });

    return google.calendar({ version: "v3", auth: oauth2Client });
  }

  private async processAutoChunk(params: {
    userId: string;
    meetingId: string;
    chunkStartMs: number;
    audioBuffer: Buffer;
    mimeType?: string;
    apiKey: string;
    jobKey: string;
  }): Promise<void> {
    const {
      userId,
      meetingId,
      chunkStartMs,
      audioBuffer,
      mimeType,
      apiKey,
      jobKey,
    } = params;
    try {
      const audioUrl = await this.uploadAudioToAssembly(
        apiKey,
        audioBuffer,
        mimeType,
      );
      const transcriptId = await this.requestAssemblyTranscript(
        apiKey,
        audioUrl,
      );
      const result = await this.pollAssemblyTranscript(apiKey, transcriptId);

      const utterances = result.utterances ?? [];
      if (!utterances.length) {
        return;
      }

      const segments = utterances
        .map((utterance) => {
          const text = utterance.text?.trim();
          if (!text) {
            return null;
          }

          const start =
            typeof utterance.start === "number" ? utterance.start : 0;
          const end =
            typeof utterance.end === "number" ? utterance.end : start + 1000;
          const speaker = utterance.speaker?.toString().trim() || "Unknown";

          return {
            meetingId,
            userId,
            speakerLabel: `Speaker ${speaker}`,
            speakerRole: "unknown" as const,
            startMs: Math.max(0, Math.round(chunkStartMs + start)),
            endMs: Math.max(0, Math.round(chunkStartMs + end)),
            text,
            confidence:
              typeof utterance.confidence === "number"
                ? Math.max(0, Math.min(1, utterance.confidence))
                : undefined,
            captureSource: "auto" as const,
          };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null);

      if (!segments.length) {
        return;
      }

      await this.transcriptModel.insertMany(segments);
    } finally {
      this.activeChunkJobs.delete(jobKey);
    }
  }

  private async uploadAudioToAssembly(
    apiKey: string,
    audioBuffer: Buffer,
    mimeType?: string,
  ): Promise<string> {
    const uploadResponse = await fetch(`${this.assemblyApiBase}/upload`, {
      method: "POST",
      headers: {
        authorization: apiKey,
        "content-type": mimeType || "application/octet-stream",
      },
      body: audioBuffer,
    });

    if (!uploadResponse.ok) {
      const details = await uploadResponse.text();
      throw new Error(
        `AssemblyAI upload failed (${uploadResponse.status}): ${details}`,
      );
    }

    const uploadPayload = (await uploadResponse.json()) as {
      upload_url?: string;
    };
    if (!uploadPayload.upload_url) {
      throw new Error("AssemblyAI upload failed: missing upload URL.");
    }

    return uploadPayload.upload_url;
  }

  private async requestAssemblyTranscript(
    apiKey: string,
    audioUrl: string,
  ): Promise<string> {
    const configuredSpeechModel = this.configService
      .get<string>("ASSEMBLYAI_SPEECH_MODEL")
      ?.trim()
      .toLowerCase();
    const speechModel =
      configuredSpeechModel === "universal-3-pro" ||
      configuredSpeechModel === "universal-2"
        ? configuredSpeechModel
        : "universal-2";

    const transcriptResponse = await fetch(
      `${this.assemblyApiBase}/transcript`,
      {
        method: "POST",
        headers: {
          authorization: apiKey,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          audio_url: audioUrl,
          speech_models: [speechModel],
          speaker_labels: true,
          punctuate: true,
          format_text: true,
          language_code: "en_us",
        }),
      },
    );

    if (!transcriptResponse.ok) {
      const details = await transcriptResponse.text();
      throw new Error(
        `AssemblyAI transcript request failed (${transcriptResponse.status}): ${details}`,
      );
    }

    const payload = (await transcriptResponse.json()) as { id?: string };
    if (!payload.id) {
      throw new Error(
        "AssemblyAI transcript request failed: missing transcript id.",
      );
    }
    return payload.id;
  }

  private async pollAssemblyTranscript(
    apiKey: string,
    transcriptId: string,
  ): Promise<{
    status: string;
    error?: string;
    utterances?: Array<{
      text?: string;
      start?: number;
      end?: number;
      speaker?: string | number;
      confidence?: number;
    }>;
  }> {
    const maxAttempts = 180;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const response = await fetch(
        `${this.assemblyApiBase}/transcript/${transcriptId}`,
        {
          headers: {
            authorization: apiKey,
          },
        },
      );

      if (!response.ok) {
        const details = await response.text();
        throw new Error(
          `AssemblyAI polling failed (${response.status}): ${details}`,
        );
      }

      const payload = (await response.json()) as {
        status: string;
        error?: string;
        utterances?: Array<{
          text?: string;
          start?: number;
          end?: number;
          speaker?: string | number;
          confidence?: number;
        }>;
      };

      if (payload.status === "completed") {
        return payload;
      }
      if (payload.status === "error") {
        throw new Error(payload.error || "AssemblyAI returned error status.");
      }

      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    throw new Error("AssemblyAI polling timed out.");
  }

  private async resolveGoogleEvent(
    calendar: ReturnType<typeof google.calendar>,
    meetingId: string,
  ): Promise<{
    title: string;
    startTime: string | null;
    endTime: string | null;
    joinUrl: string | null;
    attendees: string[];
  } | null> {
    const splitAt = meetingId.indexOf(":");
    if (splitAt <= 0 || splitAt >= meetingId.length - 1) {
      return null;
    }

    const calendarId = meetingId.slice(0, splitAt);
    const eventId = meetingId.slice(splitAt + 1);
    const result = await calendar.events.get({
      calendarId,
      eventId,
    });
    const event = result.data;

    return {
      title: event.summary ?? this.fallbackTitle(meetingId),
      startTime: event.start?.dateTime ?? null,
      endTime: event.end?.dateTime ?? null,
      joinUrl: this.extractJoinUrl(event),
      attendees: (event.attendees ?? [])
        .map(
          (attendee) =>
            attendee.displayName?.trim() || attendee.email?.trim() || "",
        )
        .filter(Boolean),
    };
  }

  private fallbackTitle(meetingId: string): string {
    const splitAt = meetingId.indexOf(":");
    const source = splitAt >= 0 ? meetingId.slice(splitAt + 1) : meetingId;
    const humanized = source.replace(/[_-]+/g, " ").trim();
    return humanized || "Transcribed meeting";
  }

  private extractJoinUrl(event: {
    hangoutLink?: string | null;
    location?: string | null;
    description?: string | null;
    conferenceData?: {
      entryPoints?: Array<{
        uri?: string | null;
        entryPointType?: string | null;
      }>;
    } | null;
  }): string | null {
    const conferenceUri = event.conferenceData?.entryPoints?.find(
      (entryPoint) =>
        entryPoint?.entryPointType === "video" && !!entryPoint.uri,
    )?.uri;

    const candidates = [
      conferenceUri,
      event.hangoutLink,
      this.extractFirstUrl(event.location),
      this.extractFirstUrl(event.description),
    ];

    for (const value of candidates) {
      if (!value) {
        continue;
      }

      try {
        const parsed = new URL(value);
        if (parsed.protocol === "http:" || parsed.protocol === "https:") {
          return parsed.toString();
        }
      } catch {
        // Ignore malformed value.
      }
    }

    return null;
  }

  private extractFirstUrl(value?: string | null): string | null {
    if (!value) {
      return null;
    }

    const match = value.match(/https?:\/\/[^\s)>"']+/i);
    return match?.[0] ?? null;
  }
}
