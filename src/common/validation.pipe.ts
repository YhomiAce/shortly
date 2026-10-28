import { BadRequestException } from '@nestjs/common';
import { createZodValidationPipe } from 'nestjs-zod';
import { ZodError } from 'zod';

/** A single field-level validation problem. */
export interface ValidationIssue {
  path: string;
  message: string;
}

/** Converts a zod error into a flat list of issues safe to send to clients. */
export function toValidationIssues(error: unknown): ValidationIssue[] {
  if (!(error instanceof ZodError)) return [];
  return error.issues.map((issue) => ({
    path: issue.path.map(String).join('.'),
    message: issue.message,
  }));
}

/** Global pipe validating `createZodDto` bodies, queries and params. */
export const AppValidationPipe = createZodValidationPipe({
  createValidationException: (error: unknown) =>
    new BadRequestException({
      statusCode: 400,
      error: 'Bad Request',
      message: 'Validation failed',
      issues: toValidationIssues(error),
    }),
});
