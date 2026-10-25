# Linux deployment

The application uses long-running Node services, PostgreSQL and Redis. The existing ChatGPT Site is a reference publication and remains unchanged. This monorepo cannot be deployed unchanged as a Cloudflare Worker; no incompatible Sites deployment is attempted.

## Local infrastructure

`docker-compose.yml` starts PostgreSQL 17 and Redis 7 on loopback-only host ports. Data persists in named Docker volumes. `docker compose stop` stops services without deleting data. Do not use `down -v` for a production database.

## Production configuration

Create an ignored `.env.production` based on `.env.example`. Set at least:

```text
NODE_ENV=production
PORT=4000
WEB_ORIGIN=https://your-domain.example
SITE_URL=https://your-domain.example
API_INTERNAL_URL=http://api:4000
DATABASE_URL=postgresql://kttravel:YOUR_PASSWORD@postgres:5432/kttravel?schema=public
REDIS_URL=redis://:YOUR_REDIS_PASSWORD@redis:6379
POSTGRES_PASSWORD=YOUR_PASSWORD
REDIS_PASSWORD=YOUR_REDIS_PASSWORD
TRUST_PROXY=1
NOTIFICATIONS_ENABLED=0
```

These are placeholders, not working credentials. Do not reuse example values. Set optional SMTP, Telegram and S3 variables only for real accounts you control. Set `S3_REGION` when your storage service requires it. The application validates the S3 endpoint and requires HTTPS in production.

```sh
docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.production.yml build
docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.production.yml up -d postgres redis
docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.production.yml run --rm api node node_modules/prisma/build/index.js migrate deploy --schema apps/api/prisma/schema.prisma
docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.production.yml run --rm api node node_modules/tsx/dist/cli.mjs --tsconfig apps/api/tsconfig.json apps/api/prisma/seed.ts
docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.production.yml up -d
```

Supply bootstrap admin values only for the one seed operation. Build arguments include the actual `SITE_URL`, since Next.js metadata and rewrites are built into the frontend. Build a new image after changing routing configuration. Run migrations before routing new application traffic. Back up the database before schema changes and keep the previous application image for rollback.

Nginx binds host port 8080 to loopback. Put a TLS-enabled managed ingress in front of it. `/api/` proxies directly to NestJS and overwrites `X-Forwarded-For`; public pages proxy to Next.js. Database and Redis host ports also remain loopback-only. On a shared server, remove those host port mappings entirely and use private service networking.

## Health and monitoring

- `/api/health/live` checks the running process.
- `/api/health/ready` requires PostgreSQL and Redis.
- Inspect worker failures with your BullMQ administration tooling and retry failed jobs deliberately after fixing configuration.
- Use real SMTP test recipients and a private test Telegram chat when validating providers. Provider delivery, actual S3 object persistence and public TLS routing have not been tested in this local session.

## Verification scope

Local database/Redis containers, committed migrations, seed, TypeScript, Node builds, PostgreSQL integration tests and real browser journeys were exercised. Production image builds, deployment to a server, backup restore, failover, monitoring and load tests require the target production environment and remain unverified. The GitHub Actions workflow is supplied but was not dispatched to a remote repository.
