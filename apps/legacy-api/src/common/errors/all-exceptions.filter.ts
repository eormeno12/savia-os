import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { DomainError } from './domain-error';

interface ErrorBody {
  statusCode: number;
  code: string;
  message: string | string[];
  requestId?: string;
}

/**
 * Single global error boundary (F0.3). Maps domain errors → HTTP, passes Nest
 * HttpExceptions through (including nestjs-zod's ZodValidationException, whose
 * per-field `errors` get surfaced), and collapses everything unexpected into a
 * 500 WITHOUT leaking internals or stack traces. Every response carries the
 * requestId so a user-facing 500 is traceable in the logs.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exception');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();
    const requestId = (req as { id?: string }).id ?? (req.headers['x-request-id'] as string | undefined);

    const body = this.toBody(exception);
    body.requestId = requestId;

    if (body.statusCode >= 500) {
      // Full detail to logs only; the client gets a generic message.
      this.logger.error(
        { err: exception, requestId, path: req.url, method: req.method },
        exception instanceof Error ? exception.message : 'Unknown error',
      );
    } else {
      this.logger.debug({ requestId, path: req.url, code: body.code }, String(body.message));
    }

    res.status(body.statusCode).json(body);
  }

  private toBody(exception: unknown): ErrorBody {
    if (exception instanceof DomainError) {
      return { statusCode: exception.status, code: exception.code, message: exception.message };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();
      if (typeof response === 'string') {
        return { statusCode: status, code: exception.name, message: response };
      }
      // nestjs-zod's ZodValidationException puts per-field issues in `errors`
      // (zod's ZodIssue[]) alongside a generic `message` — surface the detail.
      const resBody = response as {
        message?: string | string[];
        errors?: { path: (string | number)[]; message: string }[];
      };
      const message = resBody.errors?.length
        ? resBody.errors.map((i) => `${i.path.join('.')}: ${i.message}`)
        : (resBody.message ?? exception.message);
      return { statusCode: status, code: exception.name, message };
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'InternalServerError',
      message: 'Internal server error',
    };
  }
}
