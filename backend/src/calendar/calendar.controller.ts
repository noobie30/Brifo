import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AuthenticatedUser } from "../common/types/authenticated-user.type";
import { ConnectGoogleCalendarDto } from "./dto/connect-google-calendar.dto";
import { CalendarService } from "./calendar.service";

@ApiTags("calendar")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("calendar")
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  @Post("google/connect")
  connectGoogleCalendar(
    @CurrentUser() user: AuthenticatedUser,
    @Body() payload: ConnectGoogleCalendarDto,
  ) {
    return this.calendarService.connectGoogleCalendar(user.userId, payload);
  }

  @Get("events/upcoming")
  getUpcomingEvents(@CurrentUser() user: AuthenticatedUser) {
    return this.calendarService.getUpcomingEvents(user.userId);
  }
}
