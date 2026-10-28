/** A sample link inserted on first start. */
export interface SampleLink {
  slug: string;
  targetUrl: string;
  title: string;
  /** Plaintext password for the demo protected link. */
  password?: string;
  /** Days from now until expiry (negative = already expired). */
  expiresInDays?: number;
  /** Approximate number of past clicks to generate. */
  clicks: number;
}

/** Links created by the seed when the database has none. */
export const SAMPLE_LINKS: SampleLink[] = [
  { slug: 'nest-docs', targetUrl: 'https://docs.nestjs.com/', title: 'NestJS documentation', clicks: 240 },
  { slug: 'prisma-guide', targetUrl: 'https://www.prisma.io/docs/getting-started', title: 'Prisma getting started', clicks: 160 },
  {
    slug: 'spring-sale',
    targetUrl: 'https://example.com/shop/spring-sale?utm_source=shortly',
    title: 'Spring sale landing page (expires in 60 days)',
    expiresInDays: 60,
    clicks: 310,
  },
  {
    slug: 'team-handbook',
    targetUrl: 'https://example.com/internal/handbook',
    title: 'Team handbook (password: handbook)',
    password: 'handbook',
    clicks: 45,
  },
  {
    slug: 'launch-2025',
    targetUrl: 'https://example.com/blog/launch-2025',
    title: 'Old launch announcement (expired)',
    expiresInDays: -3,
    clicks: 90,
  },
];

/** A value with a relative weight. */
export type Weighted<T> = readonly [T, number];

interface SampleClient {
  device: string;
  browser: string;
  os: string;
}

/** Weighted choices used to generate plausible clicks. */
export const SAMPLE_DISTRIBUTIONS: {
  referrers: ReadonlyArray<Weighted<string | null>>;
  clients: ReadonlyArray<Weighted<SampleClient>>;
  countries: ReadonlyArray<Weighted<string>>;
} = {
  referrers: [
    [null, 30],
    ['t.co', 15],
    ['www.google.com', 20],
    ['news.ycombinator.com', 10],
    ['www.linkedin.com', 12],
    ['github.com', 8],
    ['www.reddit.com', 5],
  ],
  clients: [
    [{ device: 'desktop', browser: 'Chrome', os: 'Windows' }, 28],
    [{ device: 'desktop', browser: 'Chrome', os: 'Mac OS' }, 14],
    [{ device: 'desktop', browser: 'Firefox', os: 'Linux' }, 6],
    [{ device: 'desktop', browser: 'Safari', os: 'Mac OS' }, 8],
    [{ device: 'mobile', browser: 'Mobile Safari', os: 'iOS' }, 22],
    [{ device: 'mobile', browser: 'Chrome', os: 'Android' }, 18],
    [{ device: 'tablet', browser: 'Mobile Safari', os: 'iOS' }, 3],
    [{ device: 'bot', browser: 'Bot', os: 'unknown' }, 1],
  ],
  countries: [
    ['US', 30],
    ['GB', 12],
    ['NG', 14],
    ['DE', 9],
    ['IN', 10],
    ['CA', 6],
    ['FR', 5],
    ['unknown', 14],
  ],
};
