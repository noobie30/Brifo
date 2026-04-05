import { IsNumber, IsOptional, IsString, IsUrl } from "class-validator";

export class ConnectJiraDto {
  @IsString()
  cloudId!: string;

  @IsString()
  siteName!: string;

  @IsUrl({ require_tld: false })
  siteUrl!: string;

  @IsOptional()
  @IsString()
  defaultProjectId?: string;

  @IsOptional()
  @IsString()
  defaultProjectKey?: string;

  @IsOptional()
  @IsString()
  defaultSprintId?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  accountId?: string;

  @IsOptional()
  @IsString()
  displayName?: string;

  @IsString()
  accessToken!: string;

  @IsOptional()
  @IsString()
  refreshToken?: string;

  @IsOptional()
  @IsNumber()
  expiryDate?: number;
}
