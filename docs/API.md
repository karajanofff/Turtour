# HTTP API

Base URL is `http://localhost:4000` locally and `/api` through the website proxy. Swagger at `/docs` lists actual routes; this document supplies request-body contracts. Send `Content-Type: application/json` except for media upload.

Every unsafe request requires `Origin` equal to `WEB_ORIGIN`. Register/login return `{user,csrfToken}` and set the HTTP-only session cookie. GET `/auth/session` returns the current user and CSRF token. Authenticated writes also require `X-CSRF-Token`. Booking creation additionally requires `Idempotency-Key` containing 16–100 letters, digits, underscores or hyphens.

| Method and path | Access | Behavior |
| --- | --- | --- |
| POST `/auth/register` | Public | `{email,password,name}`; customer only |
| POST `/auth/login` | Public | `{email,password}` |
| GET `/auth/session` | Session | Current identity and CSRF token |
| POST `/auth/logout` | Session + CSRF | Revoke session and clear cookie |
| GET `/tours?q=&category=&page=1` | Public | Published catalog, twelve per page |
| GET `/tours/:slug` | Public | Itinerary, gallery, future published dates and moderated reviews |
| GET `/destinations` | Public | Destinations and attractions |
| POST `/quotes` | Public + Origin | Server pricing, remaining seats, provisional flag |
| GET/POST `/me/bookings` | Customer session | Own history / create pending reservation |
| POST `/me/bookings/:id/cancel` | Owner | Cancel before departure and release capacity |
| GET `/me/bookings/:id/confirmation` | Owner | Download text reservation record, not payment receipt |
| GET `/me/notifications` | Owner | Persisted status events |
| PATCH `/me/profile` | Owner | `{name}` |
| POST `/me/reviews` | Owner | `{bookingId,rating,text}` after completion only |
| GET/POST `/messages` | Session | Own thread; staff may view threads and reply with `{userId,body}` |
| GET `/admin/stats` | Staff | Real counts, confirmed booking value and reserved/capacity totals |
| GET `/admin/bookings?page=1` | Staff | Fifty records per page |
| PATCH `/admin/bookings/:id/status` | Staff | `{status}`; transition policy is enforced |
| GET `/admin/tours` | Staff | Full internal catalog |
| POST/PATCH `/admin/tours[/id]` | Admin | Full validated tour contract |
| POST `/admin/tours/:id/duplicate` | Admin | Draft copy including gallery and itinerary |
| POST `/admin/departures` | Admin | New future departure |
| PATCH `/admin/departures/:id` | Admin | `{price,published}`; verified pricing required to publish |
| PATCH `/admin/days/:id/order` | Admin | `{waypointIds}` containing exactly the day's IDs |
| GET `/admin/customers` | Staff | Safe user fields; never password hashes or session digests |
| PATCH `/admin/customers/:id/role` | Admin | `{role}`; no self-role change; revokes target sessions |
| GET/PATCH `/admin/reviews[/id]` | Staff/Admin | List / `{published}` moderation |
| GET/POST `/admin/media` | Admin | List / multipart `file` and JSON-encoded four-language `alt` |
| GET `/media/:id` | Public | Temporary signed read redirect for a stored public tourism image |
| GET `/health/live`, `/health/ready` | Public | Process / PostgreSQL and Redis health |

## Quote and booking request

```json
{
  "departureId": "uuid-from-catalog",
  "adults": 2,
  "children": 0,
  "extras": [],
  "promoCode": "",
  "privateTour": false
}
```

Booking adds `name`, `phone`, and `locale` (`uz`, `kaa`, `ru`, `en`). Fields such as `price`, `totalMinor`, `role` and `status` are rejected. Quote totals are safe integer minor units; persisted BigInt monetary fields serialize as decimal strings. Contact fields never appear in public catalog responses.

## Tour and pricing contracts

`packages/domain/src/index.ts` exports `tourInput`, `departureInput`, `pricingSchema`, `bookingInput` and `quoteInput`; these are the exact executable schemas. A localized scalar contains all four language keys. Tours require slug, title, description, SEO title, cancellation policy, category, duration/nights, participant limits, featured image, service arrays and publication status.

Price fields: `costs[{label,amountMinor}]`, `groupSize`, `markupBps`, `childBps`, `seasonalBps`, `taxBps`, `serviceFeeMinor`, `extras[{id,label,amountMinor}]`, optional `promo{code,discountBps}`, and `verified`. 10,000 basis points equals 100 percent. All fields are bounded and validated.

## Additional content operations

Admin-only `/admin/content` endpoints support GET/POST destinations, PATCH destinations/:id, POST/PATCH attractions[/id], POST days, PATCH tours/:id/gallery, PATCH departures/:id/capacity, GET settings and PATCH settings/:key. Gallery input is an ordered array of `{path,alt}`. Day creation accepts `{tourId,day,title,description,attractionIds}`. Capacity changes invalidate price verification and close sales until republished. Settings keys are restricted to `operatorContact`, `businessName`, `cancellationTerms` and accept `{text:{uz,kaa,ru,en}}`.

## Status and errors

Pending → confirmed, rejected or cancelled. Confirmed → completed or cancelled. Terminal states cannot reopen. Completion before departure is rejected. Capacity conflict, changed idempotency payload and closed sales return 409; invalid input 400; missing session 401; insufficient role/CSRF/origin 403; unknown record 404; exceeded rate 429; unavailable dependencies 503. Unexpected errors return a request ID without database details.
