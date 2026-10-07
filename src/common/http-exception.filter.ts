import { Catch, HttpException } from '@nestjs/common';
import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';

interface ErrorResponse {
  readonly statusCode: number;
  readonly error: string;
  readonly message: string | string[];
  readonly path: string;
  readonly timestamp: string;
}

/** Normaliza errores HTTP sin exponer trazas ni errores internos al cliente. */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const reply = http.getResponse<FastifyReply>();
    const request = http.getRequest<FastifyRequest>();

    if (reply.sent) {
      return;
    }

    const statusCode = exception instanceof HttpException ? exception.getStatus() : 500;
    const raw = exception instanceof HttpException ? exception.getResponse() : undefined;
    const response = this.normalize(statusCode, raw, request.url);
    reply.status(statusCode).send(response);
  }

  private normalize(
    statusCode: number,
    raw: string | object | undefined,
    path: string,
  ): ErrorResponse {
    if (statusCode >= 500) {
      return {
        statusCode,
        error: 'Internal Server Error',
        message: 'Ocurrió un error interno.',
        path,
        timestamp: new Date().toISOString(),
      };
    }

    if (typeof raw === 'string') {
      return {
        statusCode,
        error: this.errorName(statusCode),
        message: raw,
        path,
        timestamp: new Date().toISOString(),
      };
    }

    const message = raw && 'message' in raw ? raw.message : 'Solicitud inválida.';
    return {
      statusCode,
      error: this.errorName(statusCode),
      message: Array.isArray(message) ? message.map(String) : String(message),
      path,
      timestamp: new Date().toISOString(),
    };
  }

  private errorName(statusCode: number): string {
    if (statusCode === 400) return 'Bad Request';
    if (statusCode === 401) return 'Unauthorized';
    if (statusCode === 403) return 'Forbidden';
    if (statusCode === 404) return 'Not Found';
    if (statusCode === 409) return 'Conflict';
    if (statusCode === 429) return 'Too Many Requests';
    return 'HTTP Error';
  }
}
