import { Controller, Get } from "@nestjs/common";
import { InjectConnection } from "@nestjs/mongoose";
import { Connection } from "mongoose";

@Controller("health")
export class HealthController {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  @Get()
  health() {
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
    };
  }
}
