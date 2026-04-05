import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AuthenticatedUser } from "../common/types/authenticated-user.type";
import { NotesService } from "./notes.service";
import { GenerateNotesDto } from "./dto/generate-notes.dto";
import { ChatMeetingDto } from "./dto/chat-meeting.dto";

@ApiTags("notes")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("meetings/:meetingId/notes")
export class NotesController {
  constructor(private readonly notesService: NotesService) {}

  @Post("generate")
  generateNotes(
    @CurrentUser() user: AuthenticatedUser,
    @Param("meetingId") meetingId: string,
    @Body() payload: GenerateNotesDto,
  ) {
    return this.notesService.generateNotes(
      user.userId,
      user.name,
      meetingId,
      payload,
    );
  }

  @Get()
  getNotes(
    @CurrentUser() user: AuthenticatedUser,
    @Param("meetingId") meetingId: string,
  ) {
    return this.notesService.getNotes(user.userId, meetingId);
  }

  @Post("chat")
  chatOnMeeting(
    @CurrentUser() user: AuthenticatedUser,
    @Param("meetingId") meetingId: string,
    @Body() payload: ChatMeetingDto,
  ) {
    return this.notesService.chatOnMeeting(
      user.userId,
      meetingId,
      payload.question,
    );
  }
}
