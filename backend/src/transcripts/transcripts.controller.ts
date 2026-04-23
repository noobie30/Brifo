import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
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
    if (!this.deepgramStreamingService.isConfigured()) {
      // Surface the missing key as 503 so the renderer can stop the recording
      // immediately and tell the user, instead of silently uploading audio
      // into a void.
      throw new HttpException(
        {
          message:
            "Transcription is disabled — DEEPGRAM_API_KEY not set on backend.",
          reason: "deepgram_not_configured",
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
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
    const result = await this.deepgramStreamingService.sendAudio(
      user.userId,
      meetingId.trim(),
      file.buffer,
    );
    if (result.ok) {
      return { accepted: true, health: result.health };
    }
    return {
      accepted: false,
      reason: result.reason,
      ...(result.message ? { message: result.message } : {}),
      health: result.health,
    };
  }

  @Post("stream/stop")
  async stopStream(
    @CurrentUser() user: AuthenticatedUser,
    @Param("meetingId") meetingId: string,
  ) {
    const health = await this.deepgramStreamingService.stopSession(
      user.userId,
      meetingId.trim(),
    );
    return { stopped: true, health };
  }
}
