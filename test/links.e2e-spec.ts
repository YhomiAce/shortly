import { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { config as loadDotenv } from 'dotenv';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { ClickRecorderService } from '../src/clicks/click-recorder.service';
import { loadConfig } from '../src/config/env';
import { generateSlug } from '../src/links/slug';
import { setupApp } from '../src/setup-app';

loadDotenv({ quiet: true });
process.env.DATABASE_URL ??= 'postgresql://postgres:fleetdev@127.0.0.1:55432/shortly';
process.env.REDIS_URL ??= 'redis://127.0.0.1:56379/0';
process.env.ADMIN_API_KEY ??= 'e2e-admin-key-0123456789';
process.env.SEED_SAMPLE_DATA = 'false';
process.env.RATE_LIMIT_CREATE_PER_MINUTE = '1000';

/** Create → redirect → analytics against the real Postgres and Redis. */
describe('links (e2e)', () => {
  let app: INestApplication;
  let auth: { Authorization: string };
  const createdIds: string[] = [];

  beforeAll(async () => {
    const config = loadConfig(process.env);
    auth = { Authorization: `Bearer ${config.adminApiKey}` };
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const nestApp = moduleRef.createNestApplication<NestExpressApplication>();
    setupApp(nestApp, config);
    await nestApp.init();
    app = nestApp;
  });

  afterAll(async () => {
    for (const id of createdIds) await request(app.getHttpServer()).delete(`/api/links/${id}`).set(auth);
    await app.close();
  });

  it('reports healthy dependencies', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200);
    expect(res.body.checks).toEqual({ database: 'up', redis: 'up' });
  });

  it('rejects requests without an API key', async () => {
    await request(app.getHttpServer()).get('/api/links').expect(401);
  });

  it('creates a link, redirects to it and reports the click in analytics', async () => {
    const slug = `e2e-${generateSlug()}`;
    const created = await request(app.getHttpServer())
      .post('/api/links')
      .set(auth)
      .send({ url: 'https://example.com/e2e', slug })
      .expect(201);
    createdIds.push(created.body.id);
    expect(created.body).toMatchObject({ slug, targetUrl: 'https://example.com/e2e', clickCount: 0 });
    expect(created.body.shortUrl).toMatch(new RegExp(`/${slug}$`));

    await request(app.getHttpServer())
      .get(`/${slug}`)
      .set('Referer', 'https://news.ycombinator.com/item?id=42')
      .set('CF-IPCountry', 'NG')
      .set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36')
      .expect(302)
      .expect('Location', 'https://example.com/e2e');
    // The second hit is served from the Redis cache.
    await request(app.getHttpServer()).get(`/${slug}`).set('User-Agent', 'curl/8.5.0').expect(302);

    await app.get(ClickRecorderService).flush();

    const analytics = await request(app.getHttpServer())
      .get(`/api/links/${created.body.id}/analytics?days=7`)
      .set(auth)
      .expect(200);
    expect(analytics.body.totals).toMatchObject({ allTime: 2, inRange: 2, last24h: 2 });
    expect(analytics.body.clicksPerDay).toHaveLength(7);
    expect(analytics.body.clicksPerDay.at(-1).clicks).toBe(2);
    expect(analytics.body.referrers).toEqual(
      expect.arrayContaining([
        { key: 'news.ycombinator.com', clicks: 1 },
        { key: 'direct', clicks: 1 },
      ]),
    );
    expect(analytics.body.countries).toEqual(
      expect.arrayContaining([
        { key: 'NG', clicks: 1 },
        { key: 'unknown', clicks: 1 },
      ]),
    );
    expect(analytics.body.devices).toEqual(
      expect.arrayContaining([
        { key: 'desktop', clicks: 1 },
        { key: 'bot', clicks: 1 },
      ]),
    );
  });

  it('honours password protection and expiry', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/links')
      .set(auth)
      .send({ url: 'https://example.com/secret', password: 's3cret' })
      .expect(201);
    createdIds.push(created.body.id);
    const slug: string = created.body.slug;

    await request(app.getHttpServer()).get(`/${slug}`).expect(200).expect('Content-Type', /html/);
    await request(app.getHttpServer()).post(`/${slug}`).type('form').send({ password: 'nope' }).expect(401);
    await request(app.getHttpServer())
      .post(`/${slug}`)
      .type('form')
      .send({ password: 's3cret' })
      .expect(303)
      .expect('Location', 'https://example.com/secret');

    // Updating the link must refresh the cached redirect; the cache entry must not outlive the expiry.
    const soon = new Date(Date.now() + 1500).toISOString();
    await request(app.getHttpServer())
      .patch(`/api/links/${created.body.id}`)
      .set(auth)
      .send({ expiresAt: soon, password: null })
      .expect(200);
    await request(app.getHttpServer()).get(`/${slug}`).expect(302);
    await new Promise((resolve) => setTimeout(resolve, 1600));
    await request(app.getHttpServer()).get(`/${slug}`).expect(410);
  });

  it('serves a QR code PNG', async () => {
    const res = await request(app.getHttpServer()).get(`/api/links/${createdIds[0]}/qr`).set(auth).expect(200);
    expect(res.headers['content-type']).toBe('image/png');
    expect((res.body as Buffer).subarray(1, 4).toString()).toBe('PNG');
  });

  it('returns 404 for unknown slugs', async () => {
    await request(app.getHttpServer()).get(`/missing-${generateSlug()}`).expect(404);
  });
});
