import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type TranscriptSegmentDocument = HydratedDocument<TranscriptSegment>;

@Schema({ timestamps: true })
export class TranscriptSegment {
  @Prop({ required: true })
  meetingId!: string;

  @Prop({ required: true })
  userId!: string;

  @Prop({ required: true })
  speakerLabel!: string;

  @Prop({
    type: String,
    enum: ["internal", "external", "unknown"],
    default: "unknown",
  })
  speakerRole!: "internal" | "external" | "unknown";

  @Prop({ required: true })
  startMs!: number;

  @Prop({ required: true })
  endMs!: number;

  @Prop({ required: true })
  text!: string;

  @Prop({ min: 0, max: 1 })
  confidence?: number;

  @Prop({ type: String, enum: ["manual", "auto"], default: "manual" })
  captureSource!: "manual" | "auto";
}

export const TranscriptSegmentSchema =
  SchemaFactory.createForClass(TranscriptSegment);
TranscriptSegmentSchema.index({ meetingId: 1, startMs: 1 });
TranscriptSegmentSchema.index({ userId: 1, meetingId: 1 });
TranscriptSegmentSchema.index({ userId: 1, captureSource: 1, createdAt: -1 });
