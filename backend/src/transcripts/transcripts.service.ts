import { Injectable, Logger } from "@nestjs/common";
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
