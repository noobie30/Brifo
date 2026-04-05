import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import {
  TranscriptSegment,
  TranscriptSegmentDocument,
} from "../transcripts/schemas/transcript-segment.schema";
import { Note, NoteDocument } from "../notes/schemas/note.schema";
import { Task, TaskDocument } from "../tasks/schemas/task.schema";

@Injectable()
export class SearchService {
  constructor(
    @InjectModel(TranscriptSegment.name)
    private readonly transcriptModel: Model<TranscriptSegmentDocument>,
    @InjectModel(Note.name) private readonly noteModel: Model<NoteDocument>,
    @InjectModel(Task.name) private readonly taskModel: Model<TaskDocument>,
  ) {}

  async search(userId: string, query: string) {
    const regex = new RegExp(query, "i");

    const [transcriptHits, notes, tasks] = await Promise.all([
      this.transcriptModel
        .find({ userId, text: regex })
        .sort({ createdAt: -1 })
        .limit(20)
        .lean()
        .exec(),
      this.noteModel
        .find({
          userId,
          $or: [
            { whatMattered: regex },
            { decisions: regex },
            { risks: regex },
            { openQuestions: regex },
          ],
        })
        .sort({ updatedAt: -1 })
        .limit(20)
        .lean()
        .exec(),
      this.taskModel
        .find({
          userId,
          $or: [
            { summary: regex },
            { description: regex },
            { acceptanceCriteria: regex },
          ],
        })
        .limit(20)
        .lean()
        .exec(),
    ]);

    return {
      meetings: [],
      transcriptHits,
      notes,
      tasks,
    };
  }
}
