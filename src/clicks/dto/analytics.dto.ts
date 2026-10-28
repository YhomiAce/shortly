import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/** Query for analytics endpoints. */
export const AnalyticsQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30).describe('Window size in days, ending today (UTC)'),
});

/** DTO for {@link AnalyticsQuerySchema}. */
export class AnalyticsQueryDto extends createZodDto(AnalyticsQuerySchema) {}

const bucket = z.object({ key: z.string(), clicks: z.number().int() });

const AnalyticsSchema = z.object({
  range: z.object({ days: z.number().int(), from: z.iso.datetime(), to: z.iso.datetime() }),
  totals: z.object({
    allTime: z.number().int(),
    inRange: z.number().int(),
    last24h: z.number().int(),
    last7d: z.number().int(),
  }),
  clicksPerDay: z.array(z.object({ date: z.string().describe('YYYY-MM-DD (UTC)'), clicks: z.number().int() })),
  referrers: z.array(bucket).describe('Referrer hosts; "direct" when no referrer was sent'),
  devices: z.array(bucket),
  browsers: z.array(bucket),
  os: z.array(bucket),
  countries: z.array(bucket).describe('ISO country codes, or "unknown"'),
});

/** Response of `GET /api/links/:id/analytics`. */
export class AnalyticsDto extends createZodDto(AnalyticsSchema) {}

/** Response of `GET /api/analytics`. */
export class OverviewAnalyticsDto extends createZodDto(
  AnalyticsSchema.extend({
    links: z.number().int(),
    topLinks: z.array(z.object({ id: z.uuid(), slug: z.string(), targetUrl: z.string(), clicks: z.number().int() })),
  }),
) {}
