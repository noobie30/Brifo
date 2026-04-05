import {
  BadRequestException,
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
import { UpsertTranscriptDto } from "./dto/upsert-transcript.dto";

@ApiTags("transcripts")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("meetings/:meetingId/transcript")
export class TranscriptsController {
  constructor(private readonly transcriptsService: TranscriptsService) {}

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

  @Post("auto/chunk")
  @UseInterceptors(FileInterceptor("audio"))
  async appendAutoChunk(
    @CurrentUser() user: AuthenticatedUser,
    @Param("meetingId") meetingId: string,
    @UploadedFile() file: { buffer: Buffer; mimetype?: string } | undefined,
    @Body() payload: { chunkStartMs?: string; sequence?: string },
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException("Audio chunk is required.");
    }

    const chunkStartMs = Number.parseInt(payload.chunkStartMs ?? "0", 10);
    const sequence = Number.parseInt(payload.sequence ?? "0", 10);

    await this.transcriptsService.enqueueAutoTranscriptionChunk({
      userId: user.userId,
      meetingId: meetingId.trim(),
      chunkStartMs: Number.isFinite(chunkStartMs) ? chunkStartMs : 0,
      sequence: Number.isFinite(sequence) ? sequence : undefined,
      audioBuffer: file.buffer,
      mimeType: file.mimetype,
    });

    return { accepted: true };
  }
}
