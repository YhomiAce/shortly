import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

/** Result of a rate-limit check. */
export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  /** Seconds until the current window resets. */
  resetInSeconds: number;
}

/** Fixed-window rate limiter backed by Redis `INCR` + `EXPIRE`. */
@Injectable()
export class RateLimiterService {
  constructor(private readonly redis: RedisService) {}

  /**
   * Counts one hit against `key` and reports whether it is within `limit`
   * for the current window.
   */
  async hit(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
    const redisKey = `ratelimit:${key}`;
    const results = await this.redis.multi().incr(redisKey).expire(redisKey, windowSeconds, 'NX').ttl(redisKey).exec();
    const count = Number(results?.[0]?.[1] ?? 0);
    const ttl = Number(results?.[2]?.[1] ?? windowSeconds);
    return {
      allowed: count <= limit,
      limit,
      remaining: Math.max(0, limit - count),
      resetInSeconds: ttl > 0 ? ttl : windowSeconds,
    };
  }
}
