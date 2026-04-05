import { IsOptional, IsString, IsUrl } from "class-validator";

export class UpdateJiraApiTokenDto {
  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  siteUrl?: string;

  @IsOptional()
  @IsString()
  apiToken?: string;
}
