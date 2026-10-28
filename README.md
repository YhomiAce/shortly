# shortly

A self-hostable URL shortener with click analytics, built with NestJS, Prisma (Postgres) and Redis.

## Features

- **Short links**: use a custom slug or let shortly generate one. Links can have an expiry date and a password.
- **Fast redirects**: `GET /:slug` answers `302` and is cached in Redis. Expired links answer `410 Gone`. Password-protected links show a small password form first.
- **Asynchronous click recording**: each redirect pushes a click event onto a Redis list, and a background worker writes the events to Postgres in batches. A click records:
  - the timestamp
  - the referrer host
  - device, browser and OS, parsed from the user-agent
  - the country, taken from the `CF-IPCountry` or `X-Country` header (`unknown` when neither is present)
- **Analytics API**: totals, clicks per day, top referrers, devices, browsers, OS and countries, both per link and across all links.
- **QR codes**: `GET /api/links/:id/qr` returns a PNG.
- **API-key auth** for the management API (`Authorization: Bearer <key>`):
  - keys are stored as SHA-256 hashes
  - a bootstrap key comes from `ADMIN_API_KEY`
  - more keys can be created and revoked through the API
- **CORS** is configured with `CORS_ORIGINS`, so a browser dashboard can call the API.
- **Rate limiting** on link creation, per API key, backed by Redis (works across instances).
- **OpenAPI docs** at `/api/docs` (Swagger UI); the raw spec is at `/api/docs-json`.
- **Health check** at `GET /health`. It checks Postgres and Redis and returns `503` if either is down.
- **Sample data**: on first start with an empty database, shortly creates 5 links with a month of generated clicks.

## API overview

All `/api/*` routes need `Authorization: Bearer <API key>`.

| Method   | Path                           | Description                                                        |
| -------- | ------------------------------ | ------------------------------------------------------------------ |
| `POST`   | `/api/links`                   | Create a link `{ url, slug?, title?, expiresAt?, password? }` (rate limited) |
| `GET`    | `/api/links?page=&pageSize=&q=` | List and search links                                              |
| `GET`    | `/api/links/:id`               | Get a link                                                         |
| `PATCH`  | `/api/links/:id`               | Update `url`, `title`, `expiresAt` or `password` (`null` clears the field) |
| `DELETE` | `/api/links/:id`               | Delete a link and its clicks                                       |
| `GET`    | `/api/links/:id/qr?size=&download=` | QR code PNG for the short URL                                 |
| `GET`    | `/api/links/:id/analytics?days=30` | Analytics for one link                                         |
| `GET`    | `/api/analytics?days=30`       | Analytics across all links, plus the top links                     |
| `GET`    | `/api/keys`                    | List API keys                                                      |
| `POST`   | `/api/keys`                    | Create a key `{ name }`. The plaintext key is returned only once.  |
| `DELETE` | `/api/keys/:id`                | Revoke a key                                                       |
| `GET`    | `/:slug`                       | Redirect (public)                                                  |
| `POST`   | `/:slug`                       | Submit the password form of a protected link (public)              |
| `GET`    | `/health`                      | Health check (public)                                              |

Example:

```bash
curl -X POST http://localhost:5102/api/links \
  -H "Authorization: Bearer $ADMIN_API_KEY" -H "Content-Type: application/json" \
  -d '{"url":"https://nestjs.com","slug":"nest","expiresAt":"2027-12-31T23:59:59Z"}'
curl -i http://localhost:5102/nest            # 302 → https://nestjs.com
curl -H "Authorization: Bearer $ADMIN_API_KEY" http://localhost:5102/api/analytics
```

Errors are always JSON, in the form `{ "statusCode", "error", "message", "issues"? }`.

## Local development

You need Node 22 or newer, Corepack (for Yarn 4), Postgres and Redis.

```bash
corepack enable
yarn install                 # also runs `prisma generate`
cp .env.example .env         # then edit DATABASE_URL, REDIS_URL and ADMIN_API_KEY
yarn prisma migrate dev      # create or update the database schema
yarn start:dev               # http://localhost:5102, docs at /api/docs
```

The sample links include `team-handbook`, which is password-protected (password: `handbook`), and `launch-2025`, which has already expired.

Other scripts:

| Script            | What it does                                                   |
| ----------------- | -------------------------------------------------------------- |
| `yarn build`      | `nest build` into `dist/`                                      |
| `yarn start`      | `nest start`                                                   |
| `yarn start:prod` | `prisma migrate deploy && node dist/main`                      |
| `yarn test`       | Unit tests (slug generation and validation, user-agent and header parsing). No services needed. |
| `yarn test:e2e`   | Create → redirect → analytics against the Postgres and Redis in `.env` |
| `yarn typecheck`  | `tsc --noEmit`                                                 |

## Environment variables

All variables are read at **runtime**; none are needed at build time.

| Name                           | Required | Example                                          | Build or runtime |
| ------------------------------ | -------- | ------------------------------------------------ | ---------------- |
| `DATABASE_URL`                 | yes      | `postgresql://user:pass@db:5432/shortly`         | runtime          |
| `REDIS_URL`                    | yes      | `redis://redis:6379/0`                           | runtime          |
| `ADMIN_API_KEY`                | yes      | `openssl rand -base64 32` (at least 16 characters) | runtime        |
| `PUBLIC_BASE_URL`              | recommended | `https://sho.rt` (defaults to `http://localhost:$PORT`) | runtime  |
| `CORS_ORIGINS`                 | no       | `https://dashboard.example.com,http://localhost:5173` (`*` allows any origin; empty disables CORS) | runtime |
| `PORT`                         | no       | `5102` (default)                                 | runtime          |
| `RATE_LIMIT_CREATE_PER_MINUTE` | no       | `30` (default)                                   | runtime          |
| `SEED_SAMPLE_DATA`             | no       | `true` (default); set `false` to skip the sample links | runtime    |

## Deploying

shortly is a plain Node service and needs Postgres and Redis.

- **Install:** `yarn install --immutable`. This runs `prisma generate` through `postinstall`, so the client exists before the build.
- **Build:** `yarn build`
- **Start:** `yarn start:prod`. This applies pending migrations (`prisma migrate deploy`, which is idempotent), then runs `node dist/main`. There is no separate release step.
- **Port:** reads `PORT` (default `5102`) and listens on `0.0.0.0`.
- **Health check:** `GET /health`
- **Env vars:** set `DATABASE_URL`, `REDIS_URL` and `ADMIN_API_KEY` at runtime, plus `PUBLIC_BASE_URL` so short URLs point at your domain. Nothing is needed at build time.
- **Behind a proxy:** Express `trust proxy` is on. If you're behind Cloudflare, its `CF-IPCountry` header gives country analytics. Other proxies can set `X-Country`.

## License

MIT
