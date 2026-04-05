import { IsIn, IsOptional, IsString } from "class-validator";

export class StartMeetingDto {
  @IsString()
  title!: string;

  @IsOptional()
  @IsIn(["manual", "calendar"])
  source?: "manual" | "calendar";

  @IsOptional()
  @IsString()
  calendarEventId?: string;

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsIn(["normal", "private"])
  privacyMode?: "normal" | "private";
}
