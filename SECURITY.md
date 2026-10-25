# Security model and operational requirements

## Implemented controls

- Salted scrypt password hashing with timing-safe verification and bounded password input. There are no default administrator credentials.
- Cryptographically random opaque sessions, hashed tokens at rest, HTTP-only cookies, production Secure flag, explicit expiry and server-side logout.
- Current database roles checked on every request. Public registration cannot set a role. Role changes revoke target sessions; administrators cannot demote themselves through the API.
- Strict Zod request schemas, bounded arrays and strings, integer financial arithmetic, database foreign keys and check constraints.
- Exact Origin checks for unsafe requests, independent per-session CSRF tokens on authenticated writes, explicit credentialed CORS allowlist and Helmet headers.
- Shared Redis rate limiting with dependency failure returning 503 instead of silently disabling the limit. Login/registration and normal session reads use different quotas.
- Row-level capacity locks, atomic cancellation and idempotency keys bound to the authenticated user and parsed payload.
- Customer-only access to their reservation records, notifications and support threads. Operators have business access; customers cannot read or mutate other customers' data.
- Text is rendered as React text, not HTML. JSON-LD escapes `<`. No arbitrary remote image URL is accepted as a tour image path.
- Admin-only image upload, byte and pixel limits, actual decoder validation, metadata removal and WebP re-encoding. S3 objects are read through short-lived signed URLs.
- Generic unexpected error responses with request IDs. Logs do not print credentials, passwords, customer request bodies or session cookies.

## Before production operation

Set `NODE_ENV=production`, a real HTTPS `WEB_ORIGIN` and `SITE_URL`, strong unique database/Redis passwords, and verified provider credentials. The production proxy must strip client-supplied forwarding headers; use `TRUST_PROXY=1` only with the supplied single trusted Nginx API hop. Do not expose the API, database or Redis directly to the public network. Terminate TLS in a trusted ingress in front of the loopback-bound Nginx port.

Use a secrets manager or tightly permissioned environment files. `.env*` files, including `.env.production`, are ignored. Examples contain no production credentials. Remove bootstrap administrator credentials after seed. Decide account recovery, email verification, MFA, retention and deletion policies before serving real customers; these features are not silently simulated.

Confirm the real supplier rates and capacity before opening a departure. Check route coordinates, source image identity, photo usage rights, translations and cancellation terms. Source images are user-supplied references and have not been claimed as independently licensed commercial photography.

External notification delivery is at least once. Failed jobs are retained, not silently discarded. A stable email Message-ID helps identify retry duplicates, but it does not provide provider-level exactly-once delivery. Telegram messages contain only booking ID and event; customer contact details are not sent to Telegram.

Review dependency updates and run `npm audit` in CI. The lockfile pins transitive fixes for multer, js-yaml and deepmerge-ts through root overrides. The tested Prisma CLI remains on version 6; override compatibility was checked by generation, migrations and integration tests. Audit results are time-specific and do not constitute an independent penetration test.

No real payment is collected, so never treat `CONFIRMED` as `PAID`. A future provider adapter must verify signed webhooks, reconcile amounts and currency server-side and use a dedicated payment ledger.

## Operational maintenance

Back up PostgreSQL and S3 separately; test restoring both. Keep database storage and credentials out of source archives. Periodically delete expired sessions and implement the operator's agreed retention policy for private support messages and customer records. Monitor readiness, queue failures and database capacity. Configure a real error-monitoring destination with redaction before sending production telemetry.
