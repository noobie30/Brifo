import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { MongooseModule } from "@nestjs/mongoose";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import { TranscriptsModule } from "./transcripts/transcripts.module";
import { NotesModule } from "./notes/notes.module";
import { TasksModule } from "./tasks/tasks.module";
import { AiModule } from "./ai/ai.module";
import { CalendarModule } from "./calendar/calendar.module";
import { SearchModule } from "./search/search.module";
import { AuditModule } from "./audit/audit.module";
import { HealthModule } from "./health/health.module";
import { IntegrationsModule } from "./integrations/integrations.module";
import { envValidationSchema } from "./config/env.validation";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
      validationOptions: {
        abortEarly: false,
      },
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => [
        {
          ttl: configService.get<number>("THROTTLE_TTL", 60) * 1000,
          limit: configService.get<number>("THROTTLE_LIMIT", 120),
        },
      ],
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>(
          "MONGODB_URI",
          "mongodb://localhost:27017/brifo",
        ),
        serverSelectionTimeoutMS: 15000,
        connectTimeoutMS: 15000,
        socketTimeoutMS: 30000,
        retryAttempts: 3,
        retryDelay: 1000,
      }),
    }),
    AuthModule,
    UsersModule,
    TranscriptsModule,
    NotesModule,
    TasksModule,
    AiModule,
    CalendarModule,
    SearchModule,
    AuditModule,
    HealthModule,
    IntegrationsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
