import { IsOptional, IsString } from "class-validator";

export class UpdateJiraDefaultsDto {
  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  @IsString()
  sprintId?: string;
}
