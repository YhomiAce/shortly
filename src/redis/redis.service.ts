import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';
import { APP_CONFIG, AppConfig } from '../config/env';

/** Shared ioredis connection, closed on shutdown. */
@Injectable()
export class RedisService extends Redis implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    super(config.redisUrl, { maxRetriesPerRequest: 2, enableOfflineQueue: true });
    this.on('error', (error: Error) => this.logger.warn(`Redis error: ${error.message}`));
  }

  async onModuleDestroy(): Promise<void> {
    await this.quit().catch(() => this.disconnect());
  }
}
