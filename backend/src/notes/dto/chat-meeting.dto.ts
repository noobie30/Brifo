import { IsString } from "class-validator";

export class ChatMeetingDto {
  @IsString()
  question!: string;
}
