import { Global, Module } from '@nestjs/common';
import { RateLimiterService } from './rate-limiter.service';

/** Shared infrastructure services. */
@Global()
@Module({ providers: [RateLimiterService], exports: [RateLimiterService] })
export class CommonModule {}
