import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/** A labelled count, e.g. `{ key: "mobile", clicks: 12 }`. */
export interface Bucket {
  key: string;
  clicks: number;
}

/** Clicks on one UTC day (`YYYY-MM-DD`). */
export interface DayCount {
  date: string;
  clicks: number;
}

/** Click analytics for a time window. */
export interface Analytics {
  range: { days: number; from: string; to: string };
  totals: { allTime: number; inRange: number; last24h: number; last7d: number };
  clicksPerDay: DayCount[];
  referrers: Bucket[];
  devices: Bucket[];
  browsers: Bucket[];
  os: Bucket[];
  countries: Bucket[];
}

/** Analytics across all links, plus the most clicked links. */
export interface OverviewAnalytics extends Analytics {
  links: number;
  topLinks: Array<{ id: string; slug: string; targetUrl: string; clicks: number }>;
}

type GroupField = 'referrerHost' | 'device' | 'browser' | 'os' | 'country';

const DAY_MS = 86_400_000;
const TOP_N = 10;

/** Aggregates recorded clicks. */
@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Analytics for one link over the last `days` days (UTC). */
  async forLink(linkId: string, days: number): Promise<Analytics> {
    const exists = await this.prisma.link.findUnique({ where: { id: linkId }, select: { id: true } });
    if (!exists) throw new NotFoundException('Link not found');
    return this.compute(days, linkId);
  }

  /** Analytics for all links over the last `days` days (UTC). */
  async overview(days: number): Promise<OverviewAnalytics> {
    const from = startOfRange(days);
    const [base, links, top] = await Promise.all([
      this.compute(days),
      this.prisma.link.count(),
      this.prisma.click.groupBy({
        by: ['linkId'],
        where: { clickedAt: { gte: from } },
        _count: { _all: true },
        orderBy: { _count: { linkId: 'desc' } },
        take: TOP_N,
      }),
    ]);
    const details = await this.prisma.link.findMany({
      where: { id: { in: top.map((row) => row.linkId) } },
      select: { id: true, slug: true, targetUrl: true },
    });
    const byId = new Map(details.map((link) => [link.id, link]));
    const topLinks = top.flatMap((row) => {
      const link = byId.get(row.linkId);
      return link ? [{ ...link, clicks: row._count._all }] : [];
    });
    return { ...base, links, topLinks };
  }

  private async compute(days: number, linkId?: string): Promise<Analytics> {
    const now = new Date();
    const from = startOfRange(days, now);
    const linkFilter: Prisma.ClickWhereInput = linkId ? { linkId } : {};
    const inRange: Prisma.ClickWhereInput = { ...linkFilter, clickedAt: { gte: from } };

    const [allTime, inRangeCount, last24h, last7d, perDay, referrers, devices, browsers, os, countries] =
      await Promise.all([
        this.prisma.click.count({ where: linkFilter }),
        this.prisma.click.count({ where: inRange }),
        this.prisma.click.count({ where: { ...linkFilter, clickedAt: { gte: new Date(now.getTime() - DAY_MS) } } }),
        this.prisma.click.count({ where: { ...linkFilter, clickedAt: { gte: new Date(now.getTime() - 7 * DAY_MS) } } }),
        this.clicksPerDay(from, linkId),
        this.top('referrerHost', inRange),
        this.top('device', inRange),
        this.top('browser', inRange),
        this.top('os', inRange),
        this.top('country', inRange),
      ]);

    return {
      range: { days, from: from.toISOString(), to: now.toISOString() },
      totals: { allTime, inRange: inRangeCount, last24h, last7d },
      clicksPerDay: fillDays(from, days, perDay),
      referrers: referrers.map((bucket) => ({ ...bucket, key: bucket.key || 'direct' })),
      devices,
      browsers,
      os,
      countries,
    };
  }

  private async top(field: GroupField, where: Prisma.ClickWhereInput): Promise<Bucket[]> {
    const rows = await this.prisma.click.groupBy({
      by: [field],
      where,
      _count: { _all: true },
      orderBy: { _count: { [field]: 'desc' } },
      take: TOP_N,
    });
    // `_count` on a nullable column ignores nulls, so re-sort by the real total.
    return rows
      .map((row) => ({ key: (row[field] as string | null) ?? '', clicks: row._count._all }))
      .sort((a, b) => b.clicks - a.clicks);
  }

  private async clicksPerDay(from: Date, linkId?: string): Promise<Map<string, number>> {
    const filter = linkId ? Prisma.sql`AND link_id = ${linkId}::uuid` : Prisma.empty;
    const rows = await this.prisma.$queryRaw<Array<{ day: string; clicks: bigint }>>`
      SELECT to_char(clicked_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day, count(*) AS clicks
      FROM clicks
      WHERE clicked_at >= ${from} ${filter}
      GROUP BY 1`;
    return new Map(rows.map((row) => [row.day, Number(row.clicks)]));
  }
}

/** Midnight UTC of the first day in a `days`-long window ending today. */
function startOfRange(days: number, now: Date = new Date()): Date {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return new Date(today - (days - 1) * DAY_MS);
}

function fillDays(from: Date, days: number, counts: Map<string, number>): DayCount[] {
  return Array.from({ length: days }, (_, i) => {
    const date = new Date(from.getTime() + i * DAY_MS).toISOString().slice(0, 10);
    return { date, clicks: counts.get(date) ?? 0 };
  });
}
