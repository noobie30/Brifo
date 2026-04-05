import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AuthenticatedUser } from "../common/types/authenticated-user.type";
import { TranscriptsService } from "./transcripts.service";

@ApiTags("transcripts")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("transcripts")
export class TranscriptsHistoryController {
  constructor(private readonly transcriptsService: TranscriptsService) {}

  @Get("history")
  getHistory(
    @CurrentUser() user: AuthenticatedUser,
    @Query("limit") limit?: string,
  ) {
    const parsed = Number.parseInt(limit ?? "20", 10);
    return this.transcriptsService.getTranscribedMeetingsHistory(
      user.userId,
      Number.isFinite(parsed) ? parsed : 20,
    );
  }
}
