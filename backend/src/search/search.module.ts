import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { JwtModule } from "@nestjs/jwt";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { SearchController } from "./search.controller";
import { SearchService } from "./search.service";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import {
  TranscriptSegment,
  TranscriptSegmentSchema,
} from "../transcripts/schemas/transcript-segment.schema";
import { Note, NoteSchema } from "../notes/schemas/note.schema";
import { Task, TaskSchema } from "../tasks/schemas/task.schema";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: TranscriptSegment.name, schema: TranscriptSegmentSchema },
      { name: Note.name, schema: NoteSchema },
      { name: Task.name, schema: TaskSchema },
    ]),
    ConfigModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>("JWT_SECRET"),
      }),
    }),
  ],
  providers: [SearchService, JwtAuthGuard],
  controllers: [SearchController],
})
export class SearchModule {}
