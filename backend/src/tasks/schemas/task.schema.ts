import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";
import { JiraIssueType, JiraPriority } from "@brifo/shared";

export type TaskDocument = HydratedDocument<Task>;

@Schema({ timestamps: true })
export class Task {
  @Prop({ required: true })
  userId!: string;

  @Prop({ required: true })
  meetingId!: string;

  @Prop({
    type: String,
    enum: ["Bug", "Task", "Story", "Epic"],
    default: "Task",
  })
  issueType!: JiraIssueType;

  @Prop({ required: true })
  summary!: string;

  @Prop({ default: "" })
  description!: string;

  @Prop({ type: String, default: null })
  assigneeId!: string | null;

  @Prop({ type: String, default: null })
  reporterId!: string | null;

  @Prop({
    type: String,
    enum: ["Low", "Medium", "High", "Critical"],
    default: "Medium",
  })
  priority!: JiraPriority;

  @Prop({ type: String, default: null })
  dueDate!: string | null;

  @Prop({ default: "" })
  acceptanceCriteria!: string;

  @Prop({ type: Boolean, default: false })
  approved!: boolean;

  @Prop({ type: String, default: null })
  jiraIssueKey!: string | null;

  @Prop({ type: String, default: null })
  jiraIssueUrl!: string | null;

  @Prop({ type: Date, default: null })
  approvedAt!: Date | null;
}

export const TaskSchema = SchemaFactory.createForClass(Task);
TaskSchema.index({ userId: 1, priority: 1, dueDate: 1 });
TaskSchema.index({ userId: 1, meetingId: 1 });
