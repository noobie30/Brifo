import { IsIn, IsOptional, IsString } from "class-validator";

export const NOTE_OUTPUT_MODES = ["document", "tasks", "both"] as const;
export type NoteOutputMode = (typeof NOTE_OUTPUT_MODES)[number];

export class GenerateNotesDto {
  @IsOptional()
  @IsString()
  meetingTitle?: string;

  @IsOptional()
  @IsString()
  rawUserNotes?: string;

  @IsOptional()
  @IsString()
  templateUsed?: string;

  @IsOptional()
  @IsString()
  @IsIn(NOTE_OUTPUT_MODES)
  outputMode?: NoteOutputMode;
}
