import { NestFactory } from "@nestjs/core";
import { ExpressAdapter } from "@nestjs/platform-express";
import express from "express";
import { AppModule } from "./app.module";
import { configureApp } from "./app-setup";

let cachedApp: express.Express | undefined;

const bootstrap = async (): Promise<express.Express> => {
  const expressApp = express();
  const adapter = new ExpressAdapter(expressApp);
  const app = await NestFactory.create(AppModule, adapter, {
    logger: ["error", "warn"],
  });
  configureApp(app);
  await app.init();
  return expressApp;
};

const handler = async (
  req: express.Request,
  res: express.Response,
): Promise<void> => {
  if (!cachedApp) {
    cachedApp = await bootstrap();
  }
  // Prepend /api for subdomain routing (api.brifo.in/health → /api/health)
  if (req.url && !req.url.startsWith("/api")) {
    req.url = "/api" + req.url;
  }
  cachedApp(req, res);
};

export default handler;
