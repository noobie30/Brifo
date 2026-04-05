import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { MeetingsService } from "./meetings.service";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AuthenticatedUser } from "../common/types/authenticated-user.type";
import { StartMeetingDto } from "./dto/start-meeting.dto";
import { StopMeetingDto } from "./dto/stop-meeting.dto";
import { UpdateSpeakerMapDto } from "./dto/update-speaker-map.dto";

@ApiTags("meetings")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("meetings")
export class MeetingsController {
  constructor(private readonly meetingsService: MeetingsService) {}

  @Post("start")
  startMeeting(
    @CurrentUser() user: AuthenticatedUser,
    @Body() payload: StartMeetingDto,
  ) {
    return this.meetingsService.startMeeting(user.userId, payload);
  }

  @Post(":id/stop")
  stopMeeting(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") meetingId: string,
    @Body() _payload: StopMeetingDto,
  ) {
    return this.meetingsService.stopMeeting(user.userId, meetingId, user.name);
  }

  @Get()
  getMeetings(@CurrentUser() user: AuthenticatedUser) {
    return this.meetingsService.getMeetings(user.userId);
  }

  @Get(":id")
  getMeeting(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") meetingId: string,
  ) {
    return this.meetingsService.getMeetingById(user.userId, meetingId);
  }

  @Patch(":id/speaker-map")
  updateSpeakerMap(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") meetingId: string,
    @Body() payload: UpdateSpeakerMapDto,
  ) {
    return this.meetingsService.updateSpeakerMap(
      user.userId,
      meetingId,
      payload.speakerMap,
    );
  }
}
