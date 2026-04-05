import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { Observable } from "rxjs";
import { tap } from "rxjs/operators";
import { Request, Response } from "express";

@Injectable()
export class RequestIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    const incomingRequestId = request.headers["x-request-id"];
    const requestId =
      typeof incomingRequestId === "string" && incomingRequestId.trim()
        ? incomingRequestId
        : randomUUID();

    response.setHeader("x-request-id", requestId);
    request.headers["x-request-id"] = requestId;

    const start = Date.now();
    return next.handle().pipe(
      tap(() => {
        response.setHeader("x-response-time-ms", Date.now() - start);
      }),
    );
  }
}
