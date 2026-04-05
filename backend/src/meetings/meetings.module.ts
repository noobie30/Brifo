import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { JwtModule } from "@nestjs/jwt";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { Meeting, MeetingSchema } from "./schemas/meeting.schema";
import { MeetingsService } from "./meetings.service";
import { MeetingsController } from "./meetings.controller";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CalendarModule } from "../calendar/calendar.module";
import { TranscriptsModule } from "../transcripts/transcripts.module";

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Meeting.name, schema: MeetingSchema }]),
    ConfigModule,
    CalendarModule,
    TranscriptsModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>("JWT_SECRET"),
      }),
    }),
  ],
  providers: [MeetingsService, JwtAuthGuard],
  controllers: [MeetingsController],
  exports: [MeetingsService, MongooseModule],
})
export class MeetingsModule {}
