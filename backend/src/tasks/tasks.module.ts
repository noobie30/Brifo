import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { JwtModule } from "@nestjs/jwt";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { Task, TaskSchema } from "./schemas/task.schema";
import { TasksService } from "./tasks.service";
import { TasksController } from "./tasks.controller";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { UsersModule } from "../users/users.module";

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Task.name, schema: TaskSchema }]),
    ConfigModule,
    UsersModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>("JWT_SECRET"),
      }),
    }),
  ],
  providers: [TasksService, JwtAuthGuard],
  controllers: [TasksController],
  exports: [TasksService],
})
export class TasksModule {}
