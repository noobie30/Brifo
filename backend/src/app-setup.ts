import { INestApplication, ValidationPipe } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import compression from "compression";
import helmet from "helmet";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";
import { RequestIdInterceptor } from "./common/interceptors/request-id.interceptor";

const defaultDevOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "https://brifo.in",
  "https://www.brifo.in",
  "https://api.brifo.in",
  "https://brifo.vercel.app",
];

const resolveCorsOrigins = (): ((
  origin: string | undefined,
  callback: (error: Error | null, allow?: boolean) => void,
) => void) => {
  const fromEnv = process.env.CORS_ORIGINS?.split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  const list = fromEnv?.length ? fromEnv : [...defaultDevOrigins];
  const vercel = process.env.VERCEL_URL;
  if (vercel) {
    list.push(`https://${vercel}`);
  }

  return (origin, callback) => {
    // Electron packaged apps can send no origin or "null" origin.
    if (!origin || origin === "null" || origin.startsWith("file://")) {
      callback(null, true);
      return;
    }

    if (list.includes(origin)) {
      callback(null, true);
      return;
    }

    const isLocalhost =
      /^https?:\/\/localhost(?::\d+)?$/i.test(origin) ||
      /^https?:\/\/127\.0\.0\.1(?::\d+)?$/i.test(origin);

    if (isLocalhost) {
      callback(null, true);
      return;
    }

    callback(new Error(`CORS blocked for origin: ${origin}`), false);
  };
};

export const configureApp = (app: INestApplication): void => {
  const httpApp = app.getHttpAdapter().getInstance();
  if (httpApp?.set) {
    httpApp.set("trust proxy", 1);
  }
  app.use(helmet());
  app.use(compression());
  app.enableCors({
    origin: resolveCorsOrigins(),
    credentials: true,
  });
  app.setGlobalPrefix("api");
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidUnknownValues: true,
      stopAtFirstError: false,
    }),
  );
  app.useGlobalInterceptors(new RequestIdInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());

  const config = new DocumentBuilder()
    .setTitle("Brifo API")
    .setDescription("Bot-free AI meeting workspace API")
    .setVersion("0.1.0")
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api/docs", app, document);
};
