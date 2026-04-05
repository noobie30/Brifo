import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { TranscriptSegment } from "@brifo/shared";
import { Meeting, MeetingDocument } from "./schemas/meeting.schema";
import { StartMeetingDto } from "./dto/start-meeting.dto";
import { CalendarService } from "../calendar/calendar.service";
import { TranscriptsService } from "../transcripts/transcripts.service";
import { SpeakerResolutionService } from "../transcripts/speaker-resolution.service";

@Injectable()
export class MeetingsService {
  private readonly logger = new Logger(MeetingsService.name);

  constructor(
    @InjectModel(Meeting.name)
    private readonly meetingModel: Model<MeetingDocument>,
    private readonly calendarService: CalendarService,
    private readonly transcriptsService: TranscriptsService,
    private readonly speakerResolutionService: SpeakerResolutionService,
  ) {}

  async startMeeting(
    userId: string,
    payload: StartMeetingDto,
  ): Promise<MeetingDocument> {
    let attendees: string[] = [];

    if (payload.source === "calendar" && payload.calendarEventId) {
      try {
        attendees = await this.calendarService.getEventAttendees(
          userId,
          payload.calendarEventId,
        );
      } catch (error) {
        this.logger.warn(
          `Failed to fetch attendees for calendar event ${payload.calendarEventId}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    const meeting = new this.meetingModel({
      userId,
      title: payload.title,
      source: payload.source ?? "manual",
      calendarEventId: payload.calendarEventId,
      startTime: new Date(),
      status: "in_progress",
      language: payload.language ?? "en",
      privacyMode: payload.privacyMode ?? "normal",
      attendees,
    });

    return meeting.save();
  }

  async stopMeeting(
    userId: string,
    meetingId: string,
    loggedInUserName?: string,
  ): Promise<MeetingDocument> {
    const meeting = await this.meetingModel
      .findOneAndUpdate(
        { _id: meetingId, userId },
        {
          $set: {
            status: "processing",
            endTime: new Date(),
          },
        },
        { new: true },
      )
      .exec();

    if (!meeting) {
      throw new NotFoundException("Meeting not found");
    }

    // Fire-and-forget speaker resolution
    void this.resolveAndStoreSpeakerMap(
      userId,
      meetingId,
      meeting,
      loggedInUserName,
    ).catch((err) => {
      this.logger.error(
        `Speaker resolution failed for meeting ${meetingId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    });

    return meeting;
  }

  private async resolveAndStoreSpeakerMap(
    userId: string,
    meetingId: string,
    meeting: MeetingDocument,
    loggedInUserName?: string,
  ): Promise<void> {
    const segmentDocs = await this.transcriptsService.getSegments(
      userId,
      meetingId,
    );

    if (!segmentDocs.length) {
      return;
    }

    const segments: TranscriptSegment[] = segmentDocs.map((seg) => ({
      speakerLabel: seg.speakerLabel,
      speakerRole: seg.speakerRole,
      startMs: seg.startMs,
      endMs: seg.endMs,
      text: seg.text,
      confidence: seg.confidence,
    }));

    const speakerMap = await this.speakerResolutionService.resolveSpeakers({
      meetingId,
      userId,
      loggedInUserName: loggedInUserName || "",
      attendees: meeting.attendees || [],
      segments,
    });

    if (Object.keys(speakerMap).length > 0) {
      await this.meetingModel
        .findByIdAndUpdate(meetingId, { $set: { speakerMap } })
        .exec();

      this.logger.log(
        `Stored speaker map for meeting ${meetingId}: ${JSON.stringify(speakerMap)}`,
      );
    }
  }

  async markCompleted(meetingId: string): Promise<void> {
    await this.meetingModel
      .findByIdAndUpdate(meetingId, { $set: { status: "completed" } })
      .exec();
  }

  async getMeetings(userId: string): Promise<MeetingDocument[]> {
    return this.meetingModel.find({ userId }).sort({ startTime: -1 }).exec();
  }

  async getMeetingById(
    userId: string,
    meetingId: string,
  ): Promise<MeetingDocument> {
    const meeting = await this.meetingModel
      .findOne({ _id: meetingId, userId })
      .exec();

    if (!meeting) {
      throw new NotFoundException("Meeting not found");
    }

    return meeting;
  }

  async updateSpeakerMap(
    userId: string,
    meetingId: string,
    speakerMap: Record<string, string>,
  ): Promise<MeetingDocument> {
    const meeting = await this.meetingModel
      .findOneAndUpdate(
        { _id: meetingId, userId },
        { $set: { speakerMap } },
        { new: true },
      )
      .exec();

    if (!meeting) {
      throw new NotFoundException("Meeting not found");
    }

    return meeting;
  }
}
