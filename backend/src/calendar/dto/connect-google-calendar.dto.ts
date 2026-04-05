import { IsOptional, IsString, IsNumber } from "class-validator";

export class ConnectGoogleCalendarDto {
  @IsOptional()
  @IsString()
  accessToken?: string;

  @IsOptional()
  @IsString()
  refreshToken?: string;

  @IsOptional()
  @IsNumber()
  expiryDate?: number;
}
