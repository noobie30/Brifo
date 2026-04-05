import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { JwtModule } from "@nestjs/jwt";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { Note, NoteSchema } from "./schemas/note.schema";
import { NotesService } from "./notes.service";
import { NotesController } from "./notes.controller";
import { NotesDocumentsController } from "./notes-documents.controller";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { TranscriptsModule } from "../transcripts/transcripts.module";
import { AiModule } from "../ai/ai.module";
import { TasksModule } from "../tasks/tasks.module";
import { MeetingsModule } from "../meetings/meetings.module";

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Note.name, schema: NoteSchema }]),
    ConfigModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>("JWT_SECRET"),
      }),
    }),
    TranscriptsModule,
    AiModule,
    TasksModule,
    MeetingsModule,
  ],
  providers: [NotesService, JwtAuthGuard],
  controllers: [NotesController, NotesDocumentsController],
  exports: [NotesService],
})
export class NotesModule {}
