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
  try {
    if (!cachedApp) {
      cachedApp = await bootstrap();
    }
    // Prepend /api for subdomain routing (api.brifo.in/health → /api/health)
    if (req.url && !req.url.startsWith("/api")) {
      req.url = "/api" + req.url;
    }
    cachedApp(req, res);
  } catch (error) {
    // Bootstrap failed (usually MongoDB unreachable, bad config, or missing
    // env var). Clear the cache so the next request retries, and surface
    // the real error to the client instead of letting Vercel translate it
    // into an opaque FUNCTION_INVOCATION_FAILED.
    cachedApp = undefined;
    const name = error instanceof Error ? error.name : "Error";
    const message = error instanceof Error ? error.message : String(error);
    // eslint-disable-next-line no-console
    console.error("[serverless] bootstrap failed:", error);
    if (!res.headersSent) {
      res.statusCode = 503;
      res.setHeader("content-type", "application/json");
      res.setHeader("cache-control", "no-store");
      res.end(
        JSON.stringify({
          error: "BOOTSTRAP_FAILED",
          name,
          message,
        }),
      );
    }
  }
};

export default handler;
