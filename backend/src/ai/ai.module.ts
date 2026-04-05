import { Module } from "@nestjs/common";
import { AiService } from "./ai.service";
import { MastraNotesService } from "./mastra/services/mastra-notes.service";

@Module({
  providers: [AiService, MastraNotesService],
  exports: [AiService, MastraNotesService],
})
export class AiModule {}
