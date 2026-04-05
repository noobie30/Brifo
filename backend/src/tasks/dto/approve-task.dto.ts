import { IsOptional, IsString } from "class-validator";

export class ApproveTaskDto {
  @IsOptional()
  @IsString()
  projectKey?: string;

  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  @IsString()
  sprintId?: string;

  @IsOptional()
  @IsString()
  jiraClientId?: string;

  @IsOptional()
  @IsString()
  jiraClientSecret?: string;
}
