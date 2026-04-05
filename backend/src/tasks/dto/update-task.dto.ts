import { IsIn, IsOptional, IsString } from "class-validator";

export class UpdateTaskDto {
  @IsOptional()
  @IsString()
  @IsIn(["Bug", "Task", "Story", "Epic"])
  issueType?: "Bug" | "Task" | "Story" | "Epic";

  @IsOptional()
  @IsString()
  summary?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  assigneeId?: string | null;

  @IsOptional()
  @IsString()
  reporterId?: string | null;

  @IsOptional()
  @IsIn(["Low", "Medium", "High", "Critical"])
  priority?: "Low" | "Medium" | "High" | "Critical";

  @IsOptional()
  @IsString()
  dueDate?: string | null;

  @IsOptional()
  @IsString()
  acceptanceCriteria?: string;
}
