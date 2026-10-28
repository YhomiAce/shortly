import { Injectable, Logger, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

/** A click waiting to be persisted. */
export interface ClickEvent {
  linkId: string;
  clickedAt: string;
  referrerHost: string | null;
  device: string;
  browser: string;
  os: string;
  country: string;
}

const QUEUE_KEY = 'clicks:queue';
const BATCH_SIZE = 500;
const FLUSH_INTERVAL_MS = 1000;

/**
 * Records clicks off the redirect's hot path: redirects push events onto a
 * Redis list, and a background loop writes them to Postgres in batches.
 * Several app instances can drain the same queue safely (`LPOP` is atomic).
 */
@Injectable()
export class ClickRecorderService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(ClickRecorderService.name);
  private timer: NodeJS.Timeout | undefined;
  private draining: Promise<number> | undefined;

  constructor(
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => void this.flush().catch(() => undefined), FLUSH_INTERVAL_MS);
    this.timer.unref();
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    await this.flush().catch(() => undefined);
  }

  /** Queues a click. Never throws; falls back to a direct insert if Redis is down. */
  async record(event: ClickEvent): Promise<void> {
    try {
      await this.redis.rpush(QUEUE_KEY, JSON.stringify(event));
    } catch (error) {
      this.logger.warn(`Queueing click failed (${(error as Error).message}); writing directly`);
      await this.persist([event]).catch((dbError: Error) => this.logger.error(`Dropping click: ${dbError.message}`));
    }
  }

  /** Drains the queue into Postgres. Returns the number of clicks written. */
  flush(): Promise<number> {
    this.draining ??= this.drain().finally(() => {
      this.draining = undefined;
    });
    return this.draining;
  }

  private async drain(): Promise<number> {
    let written = 0;
    for (;;) {
      const raw = await this.redis.lpop(QUEUE_KEY, BATCH_SIZE);
      if (!raw || raw.length === 0) return written;
      const events = raw.flatMap((item) => parseEvent(item));
      try {
        written += await this.persist(events);
      } catch (error) {
        this.logger.error(`Writing ${events.length} clicks failed, requeueing: ${(error as Error).message}`);
        await this.redis.lpush(QUEUE_KEY, ...raw.reverse());
        throw error;
      }
      if (raw.length < BATCH_SIZE) return written;
    }
  }

  private async persist(events: ClickEvent[]): Promise<number> {
    if (events.length === 0) return 0;
    const linkIds = [...new Set(events.map((event) => event.linkId))];
    const existing = await this.prisma.link.findMany({ where: { id: { in: linkIds } }, select: { id: true } });
    const known = new Set(existing.map((link) => link.id));
    const rows = events
      .filter((event) => known.has(event.linkId))
      .map((event) => ({ ...event, clickedAt: new Date(event.clickedAt) }));
    if (rows.length === 0) return 0;
    const result = await this.prisma.click.createMany({ data: rows });
    return result.count;
  }
}

function parseEvent(raw: string): ClickEvent[] {
  try {
    const value = JSON.parse(raw) as ClickEvent;
    return typeof value.linkId === 'string' && typeof value.clickedAt === 'string' ? [value] : [];
  } catch {
    return [];
  }
}
