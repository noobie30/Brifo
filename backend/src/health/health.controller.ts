import { Controller, Get } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectConnection } from "@nestjs/mongoose";
import { Connection } from "mongoose";

@Controller("health")
export class HealthController {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    private readonly configService: ConfigService,
  ) {}

  @Get()
  health() {
    const deepgramKey = this.configService.get<string>("DEEPGRAM_API_KEY")?.trim();
    const openaiKey = this.configService.get<string>("OPENAI_API_KEY")?.trim();
    return {
      status: "ok",
      service: "brifo-api",
      timestamp: new Date().toISOString(),
      database:
        this.connection.readyState === 1
          ? "connected"
          : this.connection.readyState === 2
            ? "connecting"
            : "disconnected",
      deepgram: deepgramKey ? "configured" : "missing",
      openai: openaiKey ? "configured" : "missing",
    };
  }
}
