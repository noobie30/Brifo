import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  Param,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AuthenticatedUser } from "../common/types/authenticated-user.type";
import { TasksService } from "./tasks.service";
import { CreateTaskDto } from "./dto/create-task.dto";
import { UpdateTaskDto } from "./dto/update-task.dto";
import { ApproveTaskDto } from "./dto/approve-task.dto";

@ApiTags("tasks")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("tasks")
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
  getTasks(@CurrentUser() user: AuthenticatedUser) {
    return this.tasksService.getTasks(user.userId);
  }

  @Post()
  createTask(
    @CurrentUser() user: AuthenticatedUser,
    @Body() payload: CreateTaskDto,
  ) {
    return this.tasksService.createTask(user.userId, payload);
  }

  @Patch(":id")
  updateTask(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") taskId: string,
    @Body() payload: UpdateTaskDto,
  ) {
    return this.tasksService.updateTask(user.userId, taskId, payload);
  }

  @Delete(":id")
  deleteTask(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") taskId: string,
  ) {
    return this.tasksService.deleteTask(user.userId, taskId);
  }

  @Post(":id/approve")
  approveTask(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") taskId: string,
    @Body() payload: ApproveTaskDto,
  ) {
    return this.tasksService.approveTask(user.userId, taskId, payload);
  }
}
