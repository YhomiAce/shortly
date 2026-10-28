import { z } from 'zod';

const DEFAULT_PORT = 5102;

/** Splits a comma-separated list, trimming blanks. */
function csv(value: string): string[] {
  return value
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(DEFAULT_PORT),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/, error: 'DATABASE_URL must be a postgres:// URL' }),
  REDIS_URL: z.url({ protocol: /^rediss?$/, error: 'REDIS_URL must be a redis:// URL' }),
  ADMIN_API_KEY: z.string().min(16, 'ADMIN_API_KEY must be at least 16 characters'),
  CORS_ORIGINS: z.string().default(''),
  PUBLIC_BASE_URL: z.url().optional(),
  RATE_LIMIT_CREATE_PER_MINUTE: z.coerce.number().int().min(1).default(30),
  SEED_SAMPLE_DATA: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),
});

/** Validated runtime configuration. */
export interface AppConfig {
  nodeEnv: 'development' | 'production' | 'test';
  port: number;
  databaseUrl: string;
  redisUrl: string;
  adminApiKey: string;
  /** Allowed browser origins; `true` means any origin, `false` disables CORS. */
  corsOrigins: string[] | boolean;
  /** Base URL used to build short URLs, without a trailing slash. */
  publicBaseUrl: string;
  rateLimitCreatePerMinute: number;
  seedSampleData: boolean;
}

/** Injection token for {@link AppConfig}. */
export const APP_CONFIG = Symbol('APP_CONFIG');

/**
 * Parses and validates environment variables.
 *
 * @param source - the environment to read, usually `process.env`
 * @throws Error listing every invalid variable
 */
export function loadConfig(source: NodeJS.ProcessEnv): AppConfig {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${details}`);
  }
  const env = parsed.data;
  const origins = csv(env.CORS_ORIGINS);
  const corsOrigins = origins.includes('*') ? true : origins.length > 0 ? origins : false;
  const publicBaseUrl = (env.PUBLIC_BASE_URL ?? `http://localhost:${env.PORT}`).replace(/\/+$/, '');

  return {
    nodeEnv: env.NODE_ENV,
    port: env.PORT,
    databaseUrl: env.DATABASE_URL,
    redisUrl: env.REDIS_URL,
    adminApiKey: env.ADMIN_API_KEY,
    corsOrigins,
    publicBaseUrl,
    rateLimitCreatePerMinute: env.RATE_LIMIT_CREATE_PER_MINUTE,
    seedSampleData: env.SEED_SAMPLE_DATA,
  };
}
