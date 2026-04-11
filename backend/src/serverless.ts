import { NestFactory } from "@nestjs/core";
import { ExpressAdapter } from "@nestjs/platform-express";
import express from "express";
import { AppModule } from "./app.module";
import { configureApp } from "./app-setup";

let cachedApp: express.Express | undefined;

// Vercel Hobby caps invocations at ~10 s. Give bootstrap 8 s to either
// connect to Mongo and initialize every module or fail cleanly. When
// @nestjs/mongoose can't reach the DB, its retry path NEVER settles the
// module-init promise (it only logs via ExceptionHandler), which means a
// plain `await bootstrap()` would hang until Vercel kills the invocation
// and emits an opaque FUNCTION_INVOCATION_FAILED. The Promise.race below
// converts that silent hang into a real rejection that our handler's
// try/catch can turn into a descriptive 503 response.
const BOOTSTRAP_TIMEOUT_MS = 8000;

const bootstrap = async (): Promise<express.Express> => {
  const expressApp = express();
  const adapter = new ExpressAdapter(expressApp);
  const app = await NestFactory.create(AppModule, adapter, {
    logger: ["error", "warn"],
    // CRITICAL: without this, NestJS calls process.abort() (SIGABRT) on
    // any module init failure, which kills the Vercel function before
    // any try/catch, Promise.race, or logging can run — surfacing only
    // as an opaque FUNCTION_INVOCATION_FAILED. With abortOnError: false,
    // errors propagate as rejections we can catch below.
    abortOnError: false,
  });
  configureApp(app);
  await app.init();
  return expressApp;
};

const bootstrapWithTimeout = (): Promise<express.Express> => {
  return Promise.race([
    bootstrap(),
    new Promise<express.Express>((_, reject) => {
      setTimeout(() => {
        const err = new Error(
          `Bootstrap timed out after ${BOOTSTRAP_TIMEOUT_MS}ms. ` +
            `Most likely the database is unreachable or MONGODB_URI is ` +
            `misconfigured (@nestjs/mongoose hangs silently on connect ` +
            `failures — check the function's stderr logs for the real ` +
            `MongooseServerSelectionError stack).`,
        );
        err.name = "BootstrapTimeoutError";
        reject(err);
      }, BOOTSTRAP_TIMEOUT_MS);
    }),
  ]);
};

const handler = async (
  req: express.Request,
  res: express.Response,
): Promise<void> => {
  try {
    if (!cachedApp) {
      cachedApp = await bootstrapWithTimeout();
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
