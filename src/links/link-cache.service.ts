import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

/** The subset of a link needed to serve a redirect. */
export interface RedirectTarget {
  id: string;
  targetUrl: string;
  expiresAt: string | null;
  passwordHash: string | null;
}

const KEY_PREFIX = 'link:slug:';
const MISSING = '__missing__';
const TTL_SECONDS = 3600;
const MISSING_TTL_SECONDS = 30;

/**
 * Redis cache of slug → redirect target. Unknown slugs are cached briefly
 * too, so floods of bad slugs don't hit Postgres. Redis failures degrade to
 * cache misses instead of failing the redirect.
 */
@Injectable()
export class LinkCacheService {
  private readonly logger = new Logger(LinkCacheService.name);

  constructor(private readonly redis: RedisService) {}

  /**
   * Returns the cached target, `null` if the slug is cached as missing,
   * or `undefined` on a cache miss.
   */
  async get(slug: string): Promise<RedirectTarget | null | undefined> {
    try {
      const raw = await this.redis.get(KEY_PREFIX + slug);
      if (raw === null) return undefined;
      if (raw === MISSING) return null;
      return JSON.parse(raw) as RedirectTarget;
    } catch (error) {
      this.logger.warn(`Cache read failed for "${slug}": ${(error as Error).message}`);
      return undefined;
    }
  }

  /** Caches a target (or its absence). Expiring links are cached no longer than their expiry. */
  async set(slug: string, target: RedirectTarget | null): Promise<void> {
    try {
      if (!target) {
        await this.redis.set(KEY_PREFIX + slug, MISSING, 'EX', MISSING_TTL_SECONDS);
        return;
      }
      let ttl = TTL_SECONDS;
      if (target.expiresAt) {
        const untilExpiry = Math.ceil((new Date(target.expiresAt).getTime() - Date.now()) / 1000);
        ttl = Math.max(1, Math.min(ttl, untilExpiry));
      }
      await this.redis.set(KEY_PREFIX + slug, JSON.stringify(target), 'EX', ttl);
    } catch (error) {
      this.logger.warn(`Cache write failed for "${slug}": ${(error as Error).message}`);
    }
  }

  /** Removes a slug from the cache after it changes. */
  async invalidate(slug: string): Promise<void> {
    try {
      await this.redis.del(KEY_PREFIX + slug);
    } catch (error) {
      this.logger.warn(`Cache invalidation failed for "${slug}": ${(error as Error).message}`);
    }
  }
}
