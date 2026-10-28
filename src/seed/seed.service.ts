import { Inject, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { APP_CONFIG, AppConfig } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { hashPassword } from '../links/password';
import { SAMPLE_DISTRIBUTIONS, SAMPLE_LINKS } from './sample-data';

const DAY_MS = 86_400_000;
const HISTORY_DAYS = 30;
const SEED_LOCK_ID = 7_216_001;

/**
 * Inserts sample links with a month of generated clicks when the database
 * has no links. Idempotent and safe with several instances starting at once
 * (guarded by a Postgres advisory lock).
 */
@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (!this.config.seedSampleData) return;
    try {
      const created = await this.seedIfEmpty();
      if (created > 0) this.logger.log(`Seeded ${created} sample links with click history`);
    } catch (error) {
      this.logger.error(`Seeding failed: ${(error as Error).message}`);
    }
  }

  /** Seeds sample data if there are no links. Returns the number of links created. */
  async seedIfEmpty(): Promise<number> {
    const passwordHashes = new Map<string, string>();
    for (const sample of SAMPLE_LINKS) {
      if (sample.password) passwordHashes.set(sample.slug, await hashPassword(sample.password));
    }

    return this.prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${SEED_LOCK_ID})`;
        if ((await tx.link.count()) > 0) return 0;

        const random = mulberry32(42);
        const now = Date.now();
        for (const sample of SAMPLE_LINKS) {
          const createdAt = new Date(now - (HISTORY_DAYS + 5) * DAY_MS);
          const expiresAt = sample.expiresInDays === undefined ? null : new Date(now + sample.expiresInDays * DAY_MS);
          const link = await tx.link.create({
            data: {
              slug: sample.slug,
              targetUrl: sample.targetUrl,
              title: sample.title,
              passwordHash: passwordHashes.get(sample.slug) ?? null,
              expiresAt,
              createdAt,
            },
          });
          const lastClickAt = expiresAt && expiresAt.getTime() < now ? expiresAt.getTime() : now;
          const clicks = Array.from({ length: sample.clicks }, () => {
            // Skew towards recent days so the chart trends upwards.
            const ageMs = Math.pow(random(), 1.6) * HISTORY_DAYS * DAY_MS;
            const client = pick(SAMPLE_DISTRIBUTIONS.clients, random);
            return {
              linkId: link.id,
              clickedAt: new Date(lastClickAt - ageMs),
              referrerHost: pick(SAMPLE_DISTRIBUTIONS.referrers, random),
              device: client.device,
              browser: client.browser,
              os: client.os,
              country: pick(SAMPLE_DISTRIBUTIONS.countries, random),
            };
          });
          await tx.click.createMany({ data: clicks });
        }
        return SAMPLE_LINKS.length;
      },
      { timeout: 30_000 },
    );
  }
}

/** Small deterministic PRNG so the sample data looks the same on every fresh install. */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(choices: ReadonlyArray<readonly [T, number]>, random: () => number): T {
  const total = choices.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = random() * total;
  for (const [value, weight] of choices) {
    roll -= weight;
    if (roll < 0) return value;
  }
  return choices[choices.length - 1][0];
}
