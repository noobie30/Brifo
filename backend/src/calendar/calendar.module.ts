import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { CalendarController } from "./calendar.controller";
import { CalendarService } from "./calendar.service";
import { UsersModule } from "../users/users.module";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";

@Module({
  imports: [
    ConfigModule,
    UsersModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>("JWT_SECRET"),
      }),
    }),
  ],
  controllers: [CalendarController],
  providers: [CalendarService, JwtAuthGuard],
  exports: [CalendarService],
})
export class CalendarModule {}
