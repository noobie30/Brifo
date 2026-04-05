import { IsOptional, IsString } from "class-validator";

export class StopMeetingDto {
  @IsOptional()
  @IsString()
  reason?: string;
}
