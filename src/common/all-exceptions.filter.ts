import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { Prisma } from '../generated/prisma/client';

interface ErrorBody {
  statusCode: number;
  error: string;
  message: string;
  [key: string]: unknown;
}

/**
 * Turns every thrown error into a clean JSON body. Unexpected errors are
 * logged server-side and reported as a generic 500, never with a stack trace.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    if (response.headersSent) return;
    const body = this.toBody(exception);
    response.status(body.statusCode).json(body);
  }

  private toBody(exception: unknown): ErrorBody {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();
      const base: ErrorBody = {
        statusCode: status,
        error: HttpStatus[status]?.replace(/_/g, ' ') ?? 'Error',
        message: exception.message,
      };
      if (typeof payload === 'string') return { ...base, message: payload };
      const { statusCode: _s, error, message, ...rest } = payload as Record<string, unknown>;
      return {
        ...base,
        ...rest,
        error: typeof error === 'string' ? error : base.error,
        message: Array.isArray(message) ? message.join('; ') : typeof message === 'string' ? message : base.message,
      };
    }
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        return { statusCode: 409, error: 'Conflict', message: 'A record with that value already exists' };
      }
      if (exception.code === 'P2025') {
        return { statusCode: 404, error: 'Not Found', message: 'Record not found' };
      }
    }
    if (exception instanceof SyntaxError && 'body' in exception) {
      return { statusCode: 400, error: 'Bad Request', message: 'Malformed request body' };
    }
    const err = exception instanceof Error ? exception : new Error(String(exception));
    this.logger.error(err.message, err.stack);
    return { statusCode: 500, error: 'Internal Server Error', message: 'Something went wrong' };
  }
}
