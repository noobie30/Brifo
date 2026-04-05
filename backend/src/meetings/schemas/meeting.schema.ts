import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";
import { MeetingStatus } from "@brifo/shared";

export type MeetingDocument = HydratedDocument<Meeting>;

@Schema({ timestamps: true })
export class Meeting {
  @Prop({ required: true })
  userId!: string;

  @Prop({ required: true })
  title!: string;

  @Prop({ type: String, enum: ["manual", "calendar"], default: "manual" })
  source!: "manual" | "calendar";

  @Prop()
  calendarEventId?: string;

  @Prop({ required: true })
  startTime!: Date;

  @Prop()
  endTime?: Date;

  @Prop({
    type: String,
    enum: ["scheduled", "in_progress", "processing", "completed", "failed"],
    default: "in_progress",
  })
  status!: MeetingStatus;

  @Prop({ default: "en" })
  language!: string;

  @Prop({ type: String, enum: ["normal", "private"], default: "normal" })
  privacyMode!: "normal" | "private";

  @Prop({ type: [String], default: [] })
  attendees!: string[];

  @Prop({ type: Object, default: {} })
  speakerMap!: Record<string, string>;
}

export const MeetingSchema = SchemaFactory.createForClass(Meeting);
MeetingSchema.index({ userId: 1, startTime: -1 });
MeetingSchema.index({ userId: 1, status: 1 });
