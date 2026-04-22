import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { FileInterceptor } from "@nestjs/platform-express";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AuthenticatedUser } from "../common/types/authenticated-user.type";
import { TranscriptsService } from "./transcripts.service";
import { DeepgramStreamingService } from "./deepgram-streaming.service";
import { UpsertTranscriptDto } from "./dto/upsert-transcript.dto";

@ApiTags("transcripts")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("meetings/:meetingId/transcript")
export class TranscriptsController {
  constructor(
    private readonly transcriptsService: TranscriptsService,
    private readonly deepgramStreamingService: DeepgramStreamingService,
  ) {}

  @Post("segments")
  appendSegments(
    @CurrentUser() user: AuthenticatedUser,
    @Param("meetingId") meetingId: string,
    @Body() payload: UpsertTranscriptDto,
  ) {
    return this.transcriptsService.appendSegments(
      user.userId,
      meetingId,
      payload,
    );
  }

  @Get()
  getSegments(
    @CurrentUser() user: AuthenticatedUser,
    @Param("meetingId") meetingId: string,
  ) {
    return this.transcriptsService.getSegments(user.userId, meetingId);
  }

  @Post("stream/start")
  async startStream(
    @CurrentUser() user: AuthenticatedUser,
    @Param("meetingId") meetingId: string,
  ) {
    return this.deepgramStreamingService.startSession(
      user.userId,
      meetingId.trim(),
    );
  }

  @Post("stream/audio")
  @UseInterceptors(
    FileInterceptor("audio", { limits: { fileSize: 1 * 1024 * 1024 } }),
  )
  async streamAudio(
    @CurrentUser() user: AuthenticatedUser,
    @Param("meetingId") meetingId: string,
    @UploadedFile() file: { buffer: Buffer } | undefined,
  ) {
    if (!file?.buffer?.length) {
      return { accepted: false };
    }
    // sendAudio auto-recovers if the Deepgram session was lost to a
    // Vercel instance recycle, so this no longer throws 410 Gone.
    const sent = await this.deepgramStreamingService.sendAudio(
      user.userId,
      meetingId.trim(),
      file.buffer,
    );
    return { accepted: sent };
  }

  @Post("stream/stop")
  async stopStream(
    @CurrentUser() user: AuthenticatedUser,
    @Param("meetingId") meetingId: string,
  ) {
    await this.deepgramStreamingService.stopSession(
      user.userId,
      meetingId.trim(),
    );
    return { stopped: true };
  }
}
