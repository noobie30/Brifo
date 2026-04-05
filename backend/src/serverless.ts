import { NestFactory } from "@nestjs/core";
import { ExpressAdapter } from "@nestjs/platform-express";
import serverless from "serverless-http";
import express from "express";
import { AppModule } from "./app.module";
import { configureApp } from "./app-setup";

let cachedServer: ReturnType<typeof serverless> | undefined;

const bootstrap = async (): Promise<ReturnType<typeof serverless>> => {
  const expressApp = express();
  const adapter = new ExpressAdapter(expressApp);
  const app = await NestFactory.create(AppModule, adapter, {
    logger: ["error", "warn"],
  });
  configureApp(app);
  await app.init();
  return serverless(expressApp);
};

export const handler = async (
  req: express.Request,
  res: express.Response,
): Promise<void> => {
  if (!cachedServer) {
    cachedServer = await bootstrap();
  }
  // Prepend /api for subdomain routing (api.brifo.in/health → /api/health)
  if (req.url && !req.url.startsWith("/api")) {
    req.url = "/api" + req.url;
  }
  await cachedServer(req, res);
};

export default handler;
