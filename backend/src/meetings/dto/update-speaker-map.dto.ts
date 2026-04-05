import { IsObject } from "class-validator";

export class UpdateSpeakerMapDto {
  @IsObject()
  speakerMap!: Record<string, string>;
}
