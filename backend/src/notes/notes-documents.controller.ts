import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AuthenticatedUser } from "../common/types/authenticated-user.type";
import { NotesService } from "./notes.service";
import { UpdateGeneratedDocumentDto } from "./dto/update-generated-document.dto";

@ApiTags("notes")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("notes")
export class NotesDocumentsController {
  constructor(private readonly notesService: NotesService) {}

  @Get("documents")
  listDocuments(@CurrentUser() user: AuthenticatedUser) {
    return this.notesService.listGeneratedDocuments(user.userId);
  }

  @Delete("documents/:meetingId")
  deleteDocument(
    @CurrentUser() user: AuthenticatedUser,
    @Param("meetingId") meetingId: string,
  ) {
    return this.notesService.deleteGeneratedDocument(user.userId, meetingId);
  }

  @Patch("documents/:meetingId")
  updateDocument(
    @CurrentUser() user: AuthenticatedUser,
    @Param("meetingId") meetingId: string,
    @Body() payload: UpdateGeneratedDocumentDto,
  ) {
    return this.notesService.updateGeneratedDocument(
      user.userId,
      meetingId,
      payload,
    );
  }
}
