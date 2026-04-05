import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { JwtModule } from "@nestjs/jwt";
import { ConfigModule, ConfigService } from "@nestjs/config";
import {
  TranscriptSegment,
  TranscriptSegmentSchema,
} from "./schemas/transcript-segment.schema";
import { TranscriptsController } from "./transcripts.controller";
import { TranscriptsHistoryController } from "./transcripts-history.controller";
import { TranscriptsService } from "./transcripts.service";
import { SpeakerResolutionService } from "./speaker-resolution.service";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { UsersModule } from "../users/users.module";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: TranscriptSegment.name, schema: TranscriptSegmentSchema },
    ]),
    ConfigModule,
    UsersModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>("JWT_SECRET"),
      }),
    }),
  ],
  controllers: [TranscriptsController, TranscriptsHistoryController],
  providers: [TranscriptsService, SpeakerResolutionService, JwtAuthGuard],
  exports: [TranscriptsService, SpeakerResolutionService],
})
export class TranscriptsModule {}
