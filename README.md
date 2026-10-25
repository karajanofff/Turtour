# Karakalpakstan Travel

A working tourism booking platform built with Next.js App Router, React, strict TypeScript, NestJS, Prisma, PostgreSQL and Redis. Uzbek is the default interface language; Karakalpak, Russian and English are selectable. The historical fortress itinerary and 25 reference images came from the supplied Word document.

This is a functional development release. It is not a commercially verified travel offer. Seeded departure dates are development examples, prices are provisional, and booking creation stays closed until an administrator verifies and publishes the departure pricing. No supplier contracts, real customer testimonials, payment receipts or external credentials are fabricated.

## Start locally

To run the entire platform in Docker using the existing local `.env`:

```sh
docker compose -f docker-compose.yml -f docker-compose.local.yml build
docker compose -f docker-compose.yml -f docker-compose.local.yml up -d postgres redis
docker compose -f docker-compose.yml -f docker-compose.local.yml run --rm api node node_modules/prisma/build/index.js migrate deploy --schema apps/api/prisma/schema.prisma
docker compose -f docker-compose.yml -f docker-compose.local.yml up -d --wait
```

Open http://localhost:8080. The web app, API, notification worker, PostgreSQL,
Redis and Nginx run in Docker. For a fresh database, run the seed command from
`docs/DEPLOYMENT.md` using these two local Compose files. This local setup uses
HTTP and disables external notifications; use the production configuration for
public deployment. Plain `docker compose up` starts only PostgreSQL and Redis.

Requirements: Node.js 22.12+ or 24 LTS, npm, Docker with Linux containers, available ports 3000, 4000, 55432 and 56379.

```sh
npm ci
npm run env:init
docker compose up -d --wait
npm run db:migrate
npm run db:seed
npm run dev:api
```

In a second terminal:

```sh
npm run dev:web
```

Open http://localhost:3000. API documentation: http://localhost:4000/docs. Readiness: http://localhost:4000/health/ready. Run `npm run build` before `npm run start:api` and `npm run start:web` for a production-mode local build. Stop running API/worker processes before generating Prisma on Windows because the query-engine DLL is locked while in use.

`env:init` creates local infrastructure passwords, never an administrator password. Existing `.env` files are preserved. Create the first administrator by adding your own `ADMIN_EMAIL` and a strong `ADMIN_PASSWORD` of at least 16 characters to the ignored `.env`, then running `npm run db:seed`. Remove `ADMIN_PASSWORD` from the environment after bootstrapping. Seed never overwrites an existing user's password or role.

## Main workflow

1. Browse tours and open the two-day fortress itinerary.
2. Register a customer account with a password of at least 12 characters.
3. As an administrator, open `/admin`, verify actual supplier costs and publish a departure's price.
4. As a customer, choose the departure, participants and optional services, then submit a booking.
5. The server calculates the price and reserves capacity atomically. Replayed idempotency keys return the original booking.
6. Operators confirm or reject requests in `/admin`. Customer bookings and in-app notifications reflect the persisted status.
7. Customers can cancel before departure, download a reservation record, update their name, message the operator through `/contact`, and submit moderated reviews after completion.

`/admin/content` manages attraction descriptions, coordinate verification, customer roles, waypoint order and media. Tour management supports create, edit, publish, unpublish, archive and duplicate. The detailed content API also exposes destinations, gallery replacement, day creation, settings and capacity editing. Some advanced content operations currently use the documented API rather than dedicated UI forms.

## Notifications and media

```sh
npm run worker
```

In-app notifications are transactional. The worker generates reminders for confirmed tours departing within 24 hours. SMTP and Telegram delivery adapters use BullMQ retries and a PostgreSQL outbox. External delivery is disabled by default. Configure real credentials before setting `NOTIFICATIONS_ENABLED=1`. Read [SECURITY.md](SECURITY.md) before enabling outbound delivery. Failed jobs can be retried using:

```sh
node --env-file=.env scripts/retry-notifications.mjs
```

Media upload requires an S3-compatible bucket and credentials from `.env.example`. Missing configuration returns an explicit service-unavailable response. Uploads are limited to 8 MB JPEG/PNG/WebP files, decoded and re-encoded as WebP with metadata stripped. Provider delivery and S3 persistence require live credentials and have not been verified against an external account.

## Validation

```sh
npm run typecheck
npm test
docker compose exec -T postgres psql -U kttravel -d kttravel -c 'CREATE DATABASE kttravel_test'
npm run test:integration
npm run test:e2e
npm run build
npm audit --audit-level=high
```

Create `kttravel_test` once. Test runners refuse database names without the `_test` suffix. Integration tests launch a real NestJS process and use real PostgreSQL transactions. Playwright uses Microsoft Edge; install it or run `npx playwright install msedge`. Test accounts and reservations exist only in the test database. They use `example.test` addresses; external notifications stay disabled.

See [docs/VALIDATION.md](docs/VALIDATION.md) for executed checks and scope limits, [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/DATABASE.md](docs/DATABASE.md), [docs/API.md](docs/API.md) and [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Workspace and hosting

All project source, reference images, tests and documentation are now in the `Sayaxat` project directory. The local `.env` file is ignored by Git; do not commit environment secrets, `node_modules`, build output or test-generated private data. Dependencies can be restored with `npm ci`.

The existing ChatGPT Site was identified but not modified. This requested Node/PostgreSQL stack targets standard Linux hosting, not the Sites Cloudflare Worker runtime. Production deployment needs a server, domain and environment configuration; no production deployment was performed.
