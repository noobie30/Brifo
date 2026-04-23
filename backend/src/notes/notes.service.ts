import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { TranscriptSegment } from "@brifo/shared";
import { Note, NoteDocument } from "./schemas/note.schema";
import { GenerateNotesDto, NoteOutputMode } from "./dto/generate-notes.dto";
import { UpdateGeneratedDocumentDto } from "./dto/update-generated-document.dto";
import { TranscriptsService } from "../transcripts/transcripts.service";
import { AiService } from "../ai/ai.service";
import { TasksService } from "../tasks/tasks.service";
import { MeetingsService } from "../meetings/meetings.service";

@Injectable()
export class NotesService {
  constructor(
    @InjectModel(Note.name) private readonly noteModel: Model<NoteDocument>,
    private readonly transcriptsService: TranscriptsService,
    private readonly aiService: AiService,
    private readonly tasksService: TasksService,
    private readonly meetingsService: MeetingsService,
  ) {}

  async generateNotes(
    userId: string,
    loggedInUserName: string,
    meetingId: string,
    payload: GenerateNotesDto,
  ): Promise<NoteDocument> {
    const outputMode: NoteOutputMode = payload.outputMode ?? "both";
    const shouldGenerateTasks = outputMode === "tasks" || outputMode === "both";

    const existingNote = !shouldGenerateTasks
      ? await this.noteModel.findOne({ meetingId, userId }).exec()
      : null;

    const [transcriptDocs, meeting] = await Promise.all([
      this.transcriptsService.getSegments(userId, meetingId),
      this.meetingsService.getMeetingById(userId, meetingId).catch(() => null),
    ]);

    const speakerMap =
      meeting?.speakerMap && Object.keys(meeting.speakerMap).length > 0
        ? (meeting.speakerMap as Record<string, string>)
        : undefined;

    const transcript: TranscriptSegment[] = transcriptDocs.map((segment) => ({
      speakerLabel: segment.speakerLabel,
      speakerRole: segment.speakerRole,
      startMs: segment.startMs,
      endMs: segment.endMs,
      text: segment.text,
      confidence: segment.confidence,
    }));

    const { sections: generated, generator } =
      await this.aiService.generateMeetingNotes({
        meetingTitle: payload.meetingTitle?.trim() || `Meeting ${meetingId}`,
        rawUserNotes: payload.rawUserNotes,
        templateUsed: payload.templateUsed,
        loggedInUserName,
        transcript,
        includeActionItems: shouldGenerateTasks,
        speakerMap,
      });
    const generatedActionItems = shouldGenerateTasks
      ? generated.actionItems
      : (existingNote?.actionItems ?? []);

    const note = await this.noteModel
      .findOneAndUpdate(
        { meetingId, userId },
        {
          $set: {
            meetingId,
            userId,
            meetingTitle:
              payload.meetingTitle?.trim() || `Meeting ${meetingId}`,
            rawUserNotes: payload.rawUserNotes ?? "",
            templateUsed: payload.templateUsed ?? "general",
            whatMattered: generated.whatMattered,
            decisions: generated.decisions,
            actionItems: generatedActionItems,
            openQuestions: generated.openQuestions,
            risks: generated.risks,
            followUpEmail: generated.followUpEmail,
            aiGenerator: generator,
          },
        },
        { upsert: true, new: true },
      )
      .exec();

    if (shouldGenerateTasks) {
      await this.tasksService.replaceTasksForMeeting(
        userId,
        meetingId,
        generatedActionItems,
      );
    }

    return note;
  }

  async listGeneratedDocuments(userId: string): Promise<NoteDocument[]> {
    return this.noteModel.find({ userId }).sort({ updatedAt: -1 }).exec();
  }

  async deleteGeneratedDocument(
    userId: string,
    meetingId: string,
  ): Promise<{ deleted: boolean }> {
    await this.noteModel.deleteOne({ userId, meetingId }).exec();

    return { deleted: true };
  }

  async updateGeneratedDocument(
    userId: string,
    meetingId: string,
    payload: UpdateGeneratedDocumentDto,
  ): Promise<NoteDocument> {
    const existing = await this.noteModel.findOne({ userId, meetingId }).exec();
    if (!existing) {
      throw new NotFoundException("Document not found");
    }

    const normalizedActionItems =
      payload.actionItems?.map((item, index) => ({
        issueType: item.issueType ?? "Task",
        summary: item.summary?.trim() || `Jira ticket ${index + 1}`,
        description:
          item.description?.trim() ||
          item.summary?.trim() ||
          "No description provided.",
        assigneeId: item.assigneeId?.trim() || null,
        reporterId: item.reporterId?.trim() || userId,
        priority: item.priority ?? "Medium",
        dueDate: item.dueDate?.trim() || null,
        acceptanceCriteria:
          item.acceptanceCriteria?.trim() || "No acceptance criteria provided.",
      })) ?? existing.actionItems;

    const note = await this.noteModel
      .findOneAndUpdate(
        { userId, meetingId },
        {
          $set: {
            meetingTitle: payload.meetingTitle?.trim() ?? existing.meetingTitle,
            rawUserNotes: payload.rawUserNotes ?? existing.rawUserNotes,
            whatMattered: payload.whatMattered?.trim() ?? existing.whatMattered,
            decisions: (payload.decisions ?? existing.decisions)
              .map((value) => value.trim())
              .filter(Boolean),
            openQuestions: (payload.openQuestions ?? existing.openQuestions)
              .map((value) => value.trim())
              .filter(Boolean),
            risks: (payload.risks ?? existing.risks)
              .map((value) => value.trim())
              .filter(Boolean),
            followUpEmail:
              payload.followUpEmail?.trim() ?? existing.followUpEmail,
            actionItems: normalizedActionItems,
          },
        },
        { new: true },
      )
      .exec();

    if (!note) {
      throw new NotFoundException("Document not found");
    }

    if (payload.actionItems) {
      await this.tasksService.replaceTasksForMeeting(
        userId,
        meetingId,
        normalizedActionItems,
      );
    }

    return note;
  }

  async getNotes(userId: string, meetingId: string): Promise<NoteDocument> {
    const note = await this.noteModel.findOne({ userId, meetingId }).exec();
    if (!note) {
      throw new NotFoundException("Notes not found for meeting");
    }
    return note;
  }

  async chatOnMeeting(
    userId: string,
    meetingId: string,
    question: string,
  ): Promise<{ answer: string }> {
    const [note, transcriptDocs] = await Promise.all([
      this.noteModel.findOne({ userId, meetingId }).exec(),
      this.transcriptsService.getSegments(userId, meetingId),
    ]);

    if (!note) {
      throw new NotFoundException(
        "Generate notes first before chatting on a meeting",
      );
    }

    const transcript: TranscriptSegment[] = transcriptDocs.map((segment) => ({
      speakerLabel: segment.speakerLabel,
      speakerRole: segment.speakerRole,
      startMs: segment.startMs,
      endMs: segment.endMs,
      text: segment.text,
      confidence: segment.confidence,
    }));

    const answer = await this.aiService.answerMeetingQuestion(
      question,
      transcript,
      note.whatMattered,
    );

    return { answer };
  }
}
