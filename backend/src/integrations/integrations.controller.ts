import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AuthenticatedUser } from "../common/types/authenticated-user.type";
import { IntegrationsService } from "./integrations.service";
import { ConnectJiraDto } from "./dto/connect-jira.dto";
import { UpdateJiraProjectKeyDto } from "./dto/update-jira-project-key.dto";
import { UpdateJiraApiTokenDto } from "./dto/update-jira-api-token.dto";
import { UpdateJiraDefaultsDto } from "./dto/update-jira-defaults.dto";

@ApiTags("integrations")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("integrations")
export class IntegrationsController {
  constructor(private readonly integrationsService: IntegrationsService) {}

  @Get("jira")
  getJiraIntegration(@CurrentUser() user: AuthenticatedUser) {
    return this.integrationsService.getJiraIntegration(user.userId);
  }

  @Get("jira/projects")
  getJiraProjects(@CurrentUser() user: AuthenticatedUser) {
    return this.integrationsService.getJiraProjects(user.userId);
  }

  @Get("jira/sprints")
  getJiraSprints(
    @CurrentUser() user: AuthenticatedUser,
    @Query("projectId") projectId: string,
  ) {
    return this.integrationsService.getJiraSprintsForProject(
      user.userId,
      projectId,
    );
  }

  @Post("jira/connect")
  connectJira(
    @CurrentUser() user: AuthenticatedUser,
    @Body() payload: ConnectJiraDto,
  ) {
    return this.integrationsService.connectJira(user.userId, payload);
  }

  @Patch("jira/project-key")
  updateJiraProjectKey(
    @CurrentUser() user: AuthenticatedUser,
    @Body() payload: UpdateJiraProjectKeyDto,
  ) {
    return this.integrationsService.updateJiraProjectKey(user.userId, payload);
  }

  @Patch("jira/defaults")
  updateJiraDefaults(
    @CurrentUser() user: AuthenticatedUser,
    @Body() payload: UpdateJiraDefaultsDto,
  ) {
    return this.integrationsService.updateJiraDefaults(user.userId, payload);
  }

  @Patch("jira/api-token")
  updateJiraApiToken(
    @CurrentUser() user: AuthenticatedUser,
    @Body() payload: UpdateJiraApiTokenDto,
  ) {
    return this.integrationsService.updateJiraApiToken(user.userId, payload);
  }

  @Delete("jira")
  disconnectJira(@CurrentUser() user: AuthenticatedUser) {
    return this.integrationsService.disconnectJira(user.userId);
  }
}
