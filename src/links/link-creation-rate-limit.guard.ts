import { CanActivate, ExecutionContext, HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import type { Response } from 'express';
import { AuthenticatedRequest } from '../auth/api-key-principal';
import { RateLimiterService } from '../common/rate-limiter.service';
import { APP_CONFIG, AppConfig } from '../config/env';

const WINDOW_SECONDS = 60;

/**
 * Limits link creation per API key (or per IP if unauthenticated) to
 * `RATE_LIMIT_CREATE_PER_MINUTE`, using Redis so the limit holds across instances.
 * Must run after {@link ApiKeyGuard}.
 */
@Injectable()
export class LinkCreationRateLimitGuard implements CanActivate {
  constructor(
    private readonly limiter: RateLimiterService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp();
    const request = http.getRequest<AuthenticatedRequest>();
    const response = http.getResponse<Response>();
    const subject = request.apiKey ? `key:${request.apiKey.id}` : `ip:${request.ip ?? 'unknown'}`;
    const result = await this.limiter.hit(`create-link:${subject}`, this.config.rateLimitCreatePerMinute, WINDOW_SECONDS);

    response.setHeader('X-RateLimit-Limit', String(result.limit));
    response.setHeader('X-RateLimit-Remaining', String(result.remaining));
    response.setHeader('X-RateLimit-Reset', String(result.resetInSeconds));
    if (!result.allowed) {
      response.setHeader('Retry-After', String(result.resetInSeconds));
      throw new HttpException(
        {
          statusCode: 429,
          error: 'Too Many Requests',
          message: `Link creation limit of ${result.limit} per minute reached; retry in ${result.resetInSeconds}s`,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }
}
