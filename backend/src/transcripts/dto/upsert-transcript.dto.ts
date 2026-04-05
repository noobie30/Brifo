import { Type } from "class-transformer";
import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from "class-validator";

class TranscriptSegmentItemDto {
  @IsString()
  speakerLabel!: string;

  @IsOptional()
  @IsString()
  speakerRole?: "internal" | "external" | "unknown";

  @IsNumber()
  startMs!: number;

  @IsNumber()
  endMs!: number;

  @IsString()
  text!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  confidence?: number;
}

export class UpsertTranscriptDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TranscriptSegmentItemDto)
  segments!: TranscriptSegmentItemDto[];
}
