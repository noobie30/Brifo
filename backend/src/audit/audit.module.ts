import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { JwtModule } from "@nestjs/jwt";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { AuditLog, AuditLogSchema } from "./schemas/audit-log.schema";
import { AuditService } from "./audit.service";
import { AuditController } from "./audit.controller";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AuditLog.name, schema: AuditLogSchema },
    ]),
    ConfigModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>("JWT_SECRET"),
      }),
    }),
  ],
  providers: [AuditService, JwtAuthGuard],
  controllers: [AuditController],
  exports: [AuditService],
})
export class AuditModule {}
