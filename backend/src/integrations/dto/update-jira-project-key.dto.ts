import { IsOptional, IsString } from "class-validator";

export class UpdateJiraProjectKeyDto {
  @IsOptional()
  @IsString()
  projectKey?: string;
}
