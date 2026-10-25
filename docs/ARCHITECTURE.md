# Application architecture

## Boundaries

- `apps/web`: public SSR pages, accessible Radix cancellation dialog, React Hook Form booking form, TanStack Query server state, Leaflet map, customer and administrative screens.
- `apps/api`: NestJS HTTP controllers, identity guards, transactional booking service, content management, image processing, readiness checks and notification worker.
- `packages/domain`: Zod contracts, integer pricing, locale identifiers, booking transition policy and provisional cost model. Pricing has no database or HTTP dependency.
- `infrastructure`: Docker images, Compose services and Nginx reverse proxy.

The repository deliberately uses one small shared domain package rather than introducing unused UI/config packages. UI uses project CSS with Tailwind available and Radix primitives; it does not ship an unused generated shadcn component catalog. Financial and booking rules remain on the server even when clients share schemas.

## Reservation consistency

Each creation transaction locks the selected PostgreSQL `Departure` row with `SELECT FOR UPDATE`. All capacity mutations, including cancellation, operator rejection and capacity edits, acquire the same row lock. Capacity is checked and updated in the same transaction as the booking, history, audit entry, notification and outbox record. A database check constraint enforces `0 <= reserved <= capacity` independently of application code.

The pair `(userId, idempotencyKey)` is unique. A canonical parsed request is hashed; reusing a key for a different request returns 409. Identical simultaneous requests for the same departure serialize through the row lock. A private booking consumes the entire departure's capacity. Completed tours retain their historical capacity usage.

The implementation uses row locks with the default PostgreSQL isolation level; it does not depend on optimistic serializable retries. Transaction principles: [Prisma transaction reference](https://www.prisma.io/docs/orm/v6/prisma-client/queries/transactions).

## Pricing

All authoritative money is integer UZS minor units, with 100 minor units per sum. Intermediate calculations use JavaScript BigInt. Markup is a percentage of cost, not a profit margin. Twenty percent markup corresponds to 16.67 percent gross margin before any additional expenses. Totals use configured group size, child rate, seasonal multiplier, per-person extras, promotion discount, tax and one service fee. Rounding is deterministic and upward for charges. Discount rounding is downward.

The supplied cost is 30,490,000 UZS; at 20 percent markup it produces 36,588,000 UZS per group and 1,829,400 UZS per person at twenty participants. These are examples, not supplier quotations. Each departure owns its active pricing configuration; every booking stores a price snapshot. Later price edits cannot change existing totals. BigInt values cross the API as decimal integer strings, preserving precision.

## Identity and security

Passwords use salted scrypt. Random 256-bit session tokens are stored only as SHA-256 digests. The browser receives an HTTP-only, SameSite=Lax cookie, Secure in production. Session lookup fetches the current database role on each request. Authentication and authorization are distinct guards. Staff may operate reservations; only administrators may edit content, pricing and roles.

Unsafe requests must carry the exact configured Origin. Authenticated writes additionally require the session's separate CSRF token. Redis-backed rate limiting applies to login/registration and general API traffic; outages fail closed. Role changes invalidate all sessions for the affected user.

## Notifications and routing

The transactional outbox prevents loss between booking persistence and enqueueing. BullMQ delivery is at least once, so rare duplicate external messages are possible after a crash between provider success and marking delivery. Email Message-ID is stable per event. Failed jobs remain inspectable. No actual payment collection is implemented, so a confirmed booking value is not labeled collected revenue.

Leaflet uses OpenStreetMap tiles. Optional OSRM-compatible road routing activates only with a configured provider and verified waypoint coordinates. API road geometry supplies displayed road distance/time. Otherwise the interface shows approximate markers and a clear routing fallback. No straight-line segment is represented as a driven route.

## Development and production distinction

Initial customer pages, server rules, operational APIs and dashboards are implemented. Image identification, multilingual editorial review, supplier capacity, departure dates, cancellation terms, photo usage rights, live message delivery, backup restore and production load testing require the operator's real data and environment. Advanced monthly analytics, public SEO locale routes, a visual day/attraction creation wizard, payment adapters and configurable permission definitions remain expansion work. They are not represented as completed capabilities.
