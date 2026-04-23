import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type NoteDocument = HydratedDocument<Note>;

@Schema({ timestamps: true })
export class Note {
  @Prop({ required: true, unique: true })
  meetingId!: string;

  @Prop({ required: true })
  userId!: string;

  @Prop({ default: "" })
  meetingTitle!: string;

  @Prop({ default: "" })
  rawUserNotes!: string;

  @Prop({ default: "general" })
  templateUsed!: string;

  @Prop({ required: true })
  whatMattered!: string;

  @Prop({ type: [String], default: [] })
  decisions!: string[];

  @Prop({ type: [Object], default: [] })
  actionItems!: Array<{
    issueType: "Bug" | "Task" | "Story" | "Epic";
    summary: string;
    description: string;
    assigneeId: string | null;
    reporterId: string | null;
    priority: "Low" | "Medium" | "High" | "Critical";
    dueDate: string | null;
    acceptanceCriteria: string;
  }>;

  @Prop({ type: [String], default: [] })
  openQuestions!: string[];

  @Prop({ type: [String], default: [] })
  risks!: string[];

  @Prop({ default: "" })
  followUpEmail!: string;

  // Which generator produced this note. "mastra" means the OpenAI-backed
  // Mastra agent ran successfully; "fallback" means we used the
  // deterministic keyword-extraction heuristics (Mastra failed or
  // OPENAI_API_KEY was missing). Surfaced in the UI so users know when
  // they're seeing a degraded summary instead of a real AI write-up.
  @Prop({ enum: ["mastra", "fallback"], default: "mastra" })
  aiGenerator!: "mastra" | "fallback";
}

export const NoteSchema = SchemaFactory.createForClass(Note);
NoteSchema.index({ userId: 1, updatedAt: -1 });
