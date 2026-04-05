import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  ValidateIf,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

class UpdateActionItemDto {
  @IsString()
  @IsIn(["Bug", "Task", "Story", "Epic"])
  issueType!: "Bug" | "Task" | "Story" | "Epic";

  @IsString()
  summary!: string;

  @IsString()
  description!: string;

  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  assigneeId?: string | null;

  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  reporterId?: string | null;

  @IsIn(["Low", "Medium", "High", "Critical"])
  priority!: "Low" | "Medium" | "High" | "Critical";

  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  dueDate?: string | null;

  @IsString()
  acceptanceCriteria!: string;
}

export class UpdateGeneratedDocumentDto {
  @IsOptional()
  @IsString()
  meetingTitle?: string;

  @IsOptional()
  @IsString()
  rawUserNotes?: string;

  @IsOptional()
  @IsString()
  whatMattered?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  decisions?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  openQuestions?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  risks?: string[];

  @IsOptional()
  @IsString()
  followUpEmail?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateActionItemDto)
  actionItems?: UpdateActionItemDto[];
}
