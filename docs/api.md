# API

Base URL: `http://localhost:8000` &nbsp;|&nbsp; Version prefix: `/api/v1`

The API has three surfaces, and which one you are on determines everything
else:

| Surface | Prefix | Access | Purpose |
| --- | --- | --- | --- |
| Public | `/api/v1/vehicles` | Anonymous, `GET` only | Live inventory |
| Staff | `/api/v1/auth`, `/api/v1/admin` | Active staff session | Run the dealership |
| Operational | `python -m app.cli` | Server shell | Accounts and sessions |

The split is structural, not documentary. Public and staff routes are separate
routers under separate prefixes, so a privileged write cannot be one decorator
away from a public read, and the public surface stays read-only without anyone
having to remember.

Enquiries, saved vehicles, export requests, quotations and the CRM are **not
implemented**. Nothing in this document describes planned behaviour as if it
worked. Filtering on the public vehicle list is the exception and *is*
implemented - see `GET /api/v1/vehicles` and the note at the end of this
document.

Interactive documentation is served at `/docs` (Swagger UI) and `/redoc`, with the
raw schema at `/openapi.json`. Both are disabled when `DOCS_ENABLED=false`,
which should be the production setting.

---

## Conventions

**Content type.** JSON in and out, except `multipart/form-data` for image
uploads.

**Versioning.** Structural, under `/api/v1`. A breaking change introduces
`/api/v2` alongside v1 rather than altering v1, so deployed clients keep
working.

**Correlation IDs.** Send `X-Request-ID` and it is honoured, logged against, and
returned on the response. Omit it and the server generates one. Every error body
and access log line carries it, so any failure a visitor reports can be traced to
an exact log entry.

**Timestamps.** ISO 8601 with an explicit UTC offset, e.g.
`2026-01-01T00:00:00Z`.

**Identifiers.** UUID v4, rendered in canonical hyphenated form.

**Pagination.** All list endpoints will return the envelope defined in
`backend/app/utils/pagination.py`:

```json
{
  "items": [],
  "total": 0,
  "page": 1,
  "page_size": 24,
  "total_pages": 0
}
```

`page` is 1-indexed; `page_size` is capped at 100 and validated server-side, so a
client cannot request an unbounded page.

---

## Error format

Every handled failure returns the same envelope:

```json
{
  "error": {
    "code": "not_found",
    "message": "The requested resource was not found.",
    "request_id": "9f3bc7eac05a",
    "details": null
  }
}
```

`code` is stable and safe to branch on. `message` is human-readable. `details` is
present only for validation failures, where it carries the field-level errors.
Quote `request_id` in any support request.

Unhandled exceptions return `internal_error` with a generic message. Internal
detail and tracebacks are never returned to a client; they are logged instead.
With `DEBUG=true` the exception type and message are included, which is
development-only behaviour.

### Error codes

| Code | HTTP | Meaning |
| --- | --- | --- |
| `not_found` | 404 | Resource does not exist |
| `http_error` | 4xx / 5xx | Other HTTP-level failure |
| `validation_error` | 422 | Domain validation failed |
| `request_validation_error` | 422 | Body or query failed schema validation |
| `authentication_required` | 401 | Not authenticated |
| `permission_denied` | 403 | Authenticated but not allowed |
| `conflict` | 409 | Conflicts with current state, e.g. duplicate slug |
| `service_unavailable` | 503 | A dependency is unavailable |
| `internal_error` | 500 | Unexpected failure |

`not_found`, `request_validation_error`, `validation_error`, `authentication_required`,
`permission_denied` and `conflict` are all reachable today.

---

## Endpoints

### `GET /`

Discovery document. Unversioned, excluded from the schema.

```json
{
  "service": "Humera Automobile API",
  "version": "0.1.0",
  "api": "/api/v1",
  "health": "/api/v1/health"
}
```

### `GET /api/v1/health`

Liveness probe. Confirms the process is running and able to serve requests.
Deliberately performs no downstream I/O, so a database outage cannot cause an
orchestrator to restart a healthy process.

**200** - `application/json`

```json
{
  "status": "ok",
  "service": "humera-automobile-api",
  "version": "0.1.0",
  "environment": "development",
  "timestamp": "2026-01-01T00:00:00Z"
}
```

Every field is produced by the running service. `status` is `ok` or `degraded`.
`version` comes from `APP_VERSION` and `environment` from `APP_ENV`.

```bash
curl http://localhost:8000/api/v1/health
```

### `GET /api/v1/health/ready`

Readiness probe. Confirms the API can serve traffic by checking database
connectivity. Use this for load-balancer and container readiness gates; use
`/health` for liveness.

**200** when ready, **503** when a configured database is unreachable.

```json
{
  "status": "ready",
  "database": "ok",
  "checked_at": "2026-01-01T00:00:00Z"
}
```

`database` is one of:

| Value | HTTP | Meaning |
| --- | --- | --- |
| `ok` | 200 | Connection succeeded |
| `unavailable` | 503 | Configured but unreachable - investigate |
| `not_configured` | 200 | `DATABASE_URL` unset; local setup incomplete |

`not_configured` is reported separately from `unavailable` on purpose: during
local setup a developer has not created the database yet, and that is a
different situation from a production outage.

```bash
curl -i http://localhost:8000/api/v1/health/ready
```

### `GET /api/v1/vehicles`

Public vehicle inventory. Read-only: the collection accepts `GET` only, and any
other verb returns **405**. Writes live on `/api/v1/admin/vehicles`, behind a
staff session. There is no unauthenticated way to publish a vehicle.

| Query | Type | Default | Notes |
| --- | --- | --- | --- |
| `page` | integer ≥ 1 | `1` | 1-based |
| `page_size` | integer 1–100 | `24` | Maximum 100 (`MAX_PAGE_SIZE`) |
| `query` | string ≤ 120 | - | Free text, case-insensitive substring of make **or** model |
| `make` | string ≤ 120 | - | Exact, case-insensitive |
| `body_type` | string ≤ 120 | - | Exact, case-insensitive |
| `fuel` | string ≤ 120 | - | Exact, case-insensitive |
| `transmission` | string ≤ 120 | - | Exact, case-insensitive |
| `min_price` | decimal > 0 | - | Inclusive lower bound, USD |
| `max_price` | decimal > 0 | - | Inclusive upper bound, USD |
| `min_year` | integer ≥ 1900 | - | Inclusive |
| `max_year` | integer ≥ 1900 | - | Inclusive |
| `status` | `available` \| `reserved` \| `sold` | - | One availability state |

Filters combine with `AND`, and every one is optional: with none supplied the
response is byte-identical to the unfiltered list this endpoint returned before
filtering existed.

Semantics that are SQL defaults but are **not** what a caller usually expects:

- **A facet filter excludes unrecorded values.** `?fuel=Diesel` does not return a
  vehicle whose `fuel` is `NULL`. `NULL` means "not recorded", and a car whose
  fuel type was never entered is not a diesel.
- **A price filter excludes "price on request".** `?max_price=40000` does not
  return a vehicle with `price: null`, because nobody will state its price.
- **A blank value is no filter.** `?make=` and `?make=%20` both mean "no filter",
  not "make equals the empty string" - which would return an empty inventory and
  read as "we stock no Toyotas".
- **Wildcards in `query` are literal.** `%` and `_` are escaped, so `?query=%`
  matches nothing rather than everything.

There is **no sorting parameter**. A filtered page is a subset of the same
newest-first listing, not a second ordering of the same cars.

A filter matching nothing returns the same empty envelope as an empty inventory,
and for the same reason: it is the truthful answer, not an error.

Rejected filters, all **422** and all with the standard envelope:

| Case | Code |
| --- | --- |
| A single parameter out of range (`min_price=0`, `min_year=1800`, `query` over 120 chars) | `request_validation_error` |
| An unknown `status`, or a minimum above its maximum | `validation_error` |

Two codes for one status is deliberate. `request_validation_error` means one
parameter was out of range; `validation_error` means the *combination* was
contradictory, which is a rule no single parameter can express. An unknown
`status` is a `validation_error` rather than an empty result on purpose: quietly
answering `?status=avaliable` with the whole inventory would present a broken
filter link as a working one.

**200** - `application/json`, a `Page[VehicleResponse]` envelope:

```json
{
  "items": [
    {
      "id": "0f8c1d2e-3a4b-5c6d-7e8f-9a0b1c2d3e4f",
      "slug": "example-slug",
      "make": "Example",
      "model": "Example",
      "variant": null,
      "year": 2024,
      "body_type": null,
      "transmission": null,
      "fuel": null,
      "colour": null,
      "mileage_km": null,
      "vin": null,
      "price": null,
      "currency": "USD",
      "status": "available",
      "location": null,
      "images": [],
      "features": null
    }
  ],
  "total": 1,
  "page": 1,
  "page_size": 24,
  "total_pages": 1
}
```

The example values above are placeholders that show the *shape* of the response.
The database contains no vehicle rows, so a real call returns
`{"items": [], "total": 0, ...}` - see "Zero vehicles is a valid response" below.

Field notes that a client cannot infer from the type:

- `make` and `status` are the response names. The database columns are `brand`
  and `availability`; `VehicleResponse` renames them on the way out via
  `serialization_alias`. Internal columns (`created_at`, `updated_at`,
  `vehicle_id`, `position`) are never serialised.
- `price` is a number in `currency`, or `null` when the asking price is not
  published. A `0` price is rejected at every layer, so a caller can treat `0` as
  "never sent" and `null` as "deliberately withheld". There is no `$0` placeholder.
- `currency` is always `"USD"`. Non-USD is rejected in the model, by a database
  `CHECK`, and again in the response schema.
- `status` is one of `available`, `reserved`, `sold`. All three are returned by
  default; `?status=available` narrows the list server-side.
- `year` is bounded to 1900..current year + 1. The upper bound is a data-entry
  guard, not a business rule - it rejects a typo such as `2044`, not a real car.
- `images` is ordered by `position`, and position `0` is the primary photograph.
- `features` is a flat `{label: value}` object, or `null`.

**Zero vehicles is a valid response.** An empty `items` array is the correct
rendering of a dealership that has not published stock; it is not an error and
the frontend renders a real empty state from it. No seed data exists.

Ordering is newest-first by `created_at`, tie-broken by `id` so that pagination
is stable when two vehicles share a timestamp.

```bash
curl "http://localhost:8000/api/v1/vehicles?page=1&page_size=24"
```

### `GET /api/v1/vehicles/{slug}`

One vehicle, by slug. The slug is the stable public identifier used in frontend
URLs (`/inventory/{slug}`); the `id` is returned in the body but is not part of
the route.

Lookup is case-insensitive (`/vehicles/BMW-X5` and `/vehicles/bmw-x5` are the
same request), while stored slugs stay lower-case. Slugs are bounded to 200
characters.

| Outcome | HTTP | Body |
| --- | --- | --- |
| Found | 200 | `VehicleResponse` |
| No such slug | 404 | `error.code = "not_found"` |
| Slug > 200 chars | 422 | `error.code = "request_validation_error"` |

**404** means "this slug is not in the inventory". It is returned both when no
such vehicle exists and when a stored row fails response validation, so a
malformed row is never served and never reveals that it existed.

```bash
curl -i http://localhost:8000/api/v1/vehicles/no-such-vehicle
```

### Read-only by construction

Both public routes are `GET`-only. A `POST`, `PUT`, `PATCH` or `DELETE` to either
returns **405** with an `Allow: GET` header rather than creating, altering or
removing data. Verified by `test_vehicles_endpoints_are_read_only`.

The public surface accepts no write payload at all, so there is no request-body
validation surface here. Its only inputs are the two pagination bounds and the
slug length. Everything that changes data is on `/api/v1/admin`.

Archived vehicles are invisible here: they are excluded from the list, and their
slug returns **404**. The row, its photographs and its history are all retained -
see `docs/architecture.md` for why withdrawal is not deletion.

---

## Response headers

| Header | Purpose |
| --- | --- |
| `X-Request-ID` | Correlation ID, echoed from the request or generated |
| `X-Response-Time-ms` | Server processing time |
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Cross-Origin-Opener-Policy` | `same-origin` |
| `Permissions-Policy` | Camera, microphone and geolocation denied |

---

## CORS

The allow-list comes from `CORS_ORIGINS`, as a comma-separated list
(`http://localhost:3000,https://humera.example`) or a JSON array
(`["http://localhost:3000"]`). Both are accepted; a malformed JSON array is
rejected at start-up rather than silently becoming one unusable "origin".

Credentials are permitted, and `X-Request-ID` and `X-Response-Time-ms` are
exposed so the browser can read them. An origin not on the list is **not**
reflected back - verified. A wildcard, or an empty list, is rejected during
production start-up.

This matters more than it looks. A session cookie is only sent on a cross-origin
request when the request is made with credentials *and* the origin is explicitly
allowed, so a missing or malformed `CORS_ORIGINS` produces a staff UI that loads
perfectly and cannot sign in - with the only error in a browser console, pointing
at the frontend rather than at the config file.

---

## Authentication

Staff authenticate once and hold an opaque session token. There is no
registration and no password reset over HTTP: accounts exist because an operator
created them with the CLI.

### Why sessions and not JWTs

A staff session is a random 256-bit token whose SHA-256 digest is stored in
`staff_sessions`. The token is sent once, at sign-in, and never again in a
readable form.

The reason is revocation. A staff account is exactly the account that sometimes
needs to be cut off *immediately* - a stolen laptop, a leaver, a compromised
session. A self-contained token cannot be withdrawn before it expires; deleting
the row is the only way, and that is precisely what this design does:

```bash
python -m app.cli set_active --email leaked@example.com --no-active
python -m app.cli revoke_sessions --email leaked@example.com
```

Both take effect on the next request. `app/core/security.py` still contains a
working JWT implementation, tested and unused. It is not a second authentication
path to reach for - see the docstring on `create_token`.

### `POST /api/v1/auth/login`

Body: `{"email": "...", "password": "..."}`.

| Outcome | Status | Code |
| --- | --- | --- |
| Credentials good, account active and staff | 200 | - |
| Unknown email, or wrong password | 401 | `authentication_required` |
| Known account, but disabled or not staff | 403 | `permission_denied` |
| Malformed body | 422 | `request_validation_error` |

The first two share one message and comparable timing, deliberately. A distinct
response for each turns the sign-in form into a way to enumerate which staff
addresses exist, and the unknown-account path still runs a password verification
so it does not answer measurably faster.

```json
{
  "token": "…opaque session token…",
  "expires_at": "2026-01-08T00:00:00Z",
  "user": {
    "id": "0f8c1d2e-3a4b-5c6d-7e8f-9a0b1c2d3e4f",
    "full_name": "Humera Staff",
    "email": "staff@humera.example",
    "is_staff": true
  }
}
```

The response also sets the `humera_staff_session` cookie: `HttpOnly`,
`SameSite=Lax`, `Secure` in production, `Path=/`, lifetime
`SESSION_EXPIRE_MINUTES` (7 days by default). The token is in the body as well so
a non-browser client can use it; the browser should ignore it and rely on the
cookie.

The same 401 covers an unknown email and a wrong password.

### `GET /api/v1/auth/me`

Returns the same `user` object for the current session. Used by the admin UI to
decide whether to render a session or a sign-in form. **401** without a valid
session.

### `POST /api/v1/auth/logout`

Revokes the session row. Idempotent: signing out with no session is a **200**, not
an error, so a client can always call it on the way out. The cookie is cleared
either way.

### Presenting the session

Either works, and the frontend uses the cookie:

```
Cookie: humera_staff_session=<token>
Authorization: Bearer <token>
```

A cookie is used in the browser because it is attached automatically and cannot
be read by JavaScript. The bearer form exists for scripts and for tests. The
cookie is checked first, so a request carrying both uses the cookie.

### 401 versus 403

This distinction is load-bearing and easy to get wrong:

| Situation | Status | Code |
| --- | --- | --- |
| No token | 401 | `authentication_required` |
| Token unknown, malformed, expired or revoked | 401 | `authentication_required` |
| Valid token, account is not a staff member | 403 | `permission_denied` |
| Valid token, account is deactivated | 403 | `permission_denied` |

**401 means "I do not know who you are"; 403 means "I know, and the answer is
no."** Collapsing them would make a deactivated account indistinguishable from a
forgotten password, and a client cannot react to "sign in again" when the
password is not the problem.

A valid session's `last_used_at` is refreshed at most once every
`SESSION_LAST_USED_REFRESH_SECONDS` (5 minutes), so an active operator does not
write to the database on every click.

---

## Staff vehicle management

All routes require an active staff session. They are the only way to change
inventory.

**A withdrawn vehicle is archived, not deleted.** `archive` sets `archived_at`,
which removes it from the public list and makes its public page 404, while
keeping the row, its photographs and its edit history. `restore` reverses it
exactly, and archiving an already-archived vehicle is a no-op that returns the
same `archived_at` rather than a new one - so a double-click cannot rewrite the
moment of withdrawal. An archived vehicle stays editable, which is the point: a
sold car that comes back needs its price corrected, not to be re-entered.

### `GET /api/v1/admin/vehicles`

Like the public list, plus staff-only fields. **Archived vehicles are always
included** - this is the working view, and filtering them out server-side would
mean an editor could not find the car they are trying to restore.

| Query | Type | Default | Notes |
| --- | --- | --- | --- |
| `page` | integer ≥ 1 | `1` | 1-based |
| `page_size` | integer 1–100 | `24` | Maximum 100 |

Returns `Page[VehicleAdminResponse]`, which adds `archived_at`, `created_at` and
`updated_at` to the public shape. A client distinguishes published from withdrawn
by `archived_at` being `null`.

Filtering - by make, price, status - is **not implemented on the staff list**, and
that is deliberate. An editor looking for a car to restore has to be able to find
it by whatever they remember about it, including details that no longer match the
published data, so narrowing their view by a facet is the wrong default. The
public list's filters are documented under `GET /api/v1/vehicles`; they are not
reused here.

```bash
curl -b cookies.txt "http://localhost:8000/api/v1/admin/vehicles?page=1"
```

### `GET /api/v1/admin/vehicles/-/summary`

Dashboard counters. Every number is a real `COUNT`; there are no trends or
percentages, because those would need history this schema does not have and an
invented trend line is a fabricated claim about the business.

Declared *before* `/{vehicle_id}` on purpose, so the literal path is not captured
as a UUID and rejected as malformed. The `/-/` prefix is a second guard: no UUID
can begin with `-`.

```json
{
  "total_published": 12,
  "archived": 3,
  "by_availability": { "available": 9, "reserved": 2, "sold": 1 },
  "image_count": 27
}
```

`total_published` counts vehicles a visitor can actually see. Deriving it from the
total row count would quietly disagree with the public list the moment anything
is archived.

### `GET /api/v1/admin/vehicles/{vehicle_id}`

One vehicle, by UUID, including archived ones. This is the only way to reach an
archived vehicle, by design.

### `POST /api/v1/admin/vehicles`

**201** with the created vehicle. Requires `slug`, `make`, `model`, `year` and
`status`; `currency` defaults to `"USD"` and everything else is optional.

`brand`/`availability` are accepted as aliases for `make`/`status` on input, and
`make`/`status` are what come back. Sending both spellings of the same field is a
**422** rather than a silent pick.

A duplicate `slug` is a **409** `conflict`. A slug collision is checked in the
service *and* is backed by a unique constraint, because a check alone is a race.

### `PATCH /api/v1/admin/vehicles/{vehicle_id}`

Partial update. Only the fields present in the body are touched; omitting a field
leaves it alone, and `null` is a real instruction to clear it. This is why `PATCH`
and not `PUT` - a `PUT` here would silently wipe every omitted field.

`slug` is editable. Changing it changes the public URL, so the old one 404s
immediately. There is no redirect, because a redirect table for slugs is
infrastructure that outlives the reason for it; keep slugs stable.

### `POST /api/v1/admin/vehicles/{vehicle_id}/archive`

Sets `archived_at`. Idempotent.

```json
{ "id": "...", "slug": "...", "status": "sold", "archived_at": "2026-01-01T00:00:00Z" }
```

`archived_at` is always serialised with an explicit UTC offset. SQLite returns
naive datetimes and PostgreSQL returns `TIMESTAMPTZ`, so without normalising at
the schema the same field arrives as `...Z` on one request and as a bare `...` on
the next - and a client cannot tell a missing offset from local time.

### `POST /api/v1/admin/vehicles/{vehicle_id}/restore`

Clears `archived_at`. Idempotent, same response shape.

```bash
curl -X POST -b cookies.txt \
  http://localhost:8000/api/v1/admin/vehicles/$ID/archive
```

---

## Staff image management

Photographs are stored on the filesystem and their metadata in
`vehicle_images`. Every route requires a staff session. Position `0` is the
primary photograph.

### `POST /api/v1/admin/vehicles/{vehicle_id}/images`

`multipart/form-data` with repeated `files` parts and one `alts` value per file,
in the same order.

```bash
curl -X POST -b cookies.txt \
  -F "files=@front.jpg" -F "files=@rear.jpg" \
  -F "alts=Front three-quarter view" -F "alts=Rear view" \
  http://localhost:8000/api/v1/admin/vehicles/$ID/images
```

**201** with the full gallery and a count of what this request added:

```json
{
  "images": [
    {
      "id": "0f8c1d2e-3a4b-5c6d-7e8f-9a0b1c2d3e4f",
      "src": "/media/2026/01/9f8c1d2e3a4b5c6d7e8f9a0b1c2d3e4f.jpg",
      "alt": "Front three-quarter view",
      "width": 1600,
      "height": 1200,
      "position": 0
    }
  ],
  "created": 1
}
```

There is no `is_primary` flag. Position `0` *is* the primary image, and storing
that as a second source of truth would be one more thing that can disagree with
the other.

`created` is this request's count, not the gallery size. Uploading to a vehicle
that already has photographs returns the whole gallery *and* the number of files
just accepted, and the two are different numbers.

Alt text is required for every file. It is not derived from the vehicle name,
because a description invented from metadata is a description that is wrong.

**The batch is all or nothing.** One bad file rejects the whole request with
**422**, storing none of them and leaving nothing on disk. A partial upload would
leave the caller believing it failed while the gallery had silently changed.

| Rejected | Why |
| --- | --- |
| Bytes that are not JPEG, PNG or WebP | Decoded before any byte is written |
| A GIF/PHP polyglot, or any other format | Only three formats are allowed, whatever the filename says |
| Under `IMAGE_MIN_WIDTH` × `IMAGE_MIN_HEIGHT` | A tracking pixel is not a car photograph |
| Over `IMAGE_MAX_BYTES`, or the pixel ceiling | Bounded in both directions, so a decompression bomb cannot exhaust memory |
| Blank or missing `alt` | Required |
| More than `IMAGE_MAX_FILES_PER_REQUEST` files | Per-request cap |
| More than `IMAGE_MAX_PER_VEHICLE` in total | Per-vehicle cap, enforced against the database |

Files are re-encoded to strip EXIF, so a photograph cannot carry a GPS fix or a
device serial number to the public site.

The storage key is generated by the server - a random 128-bit hex digest, the
extension taken from the format *Pillow detected*, sharded by month
(`2026/01/9f8c….jpg`). The uploaded filename is never part of it: a
caller-supplied name is attacker-controlled, and can carry a traversal sequence, a
second extension (`car.jpg.php`), or 4 KB of text that ends up in a URL. A PNG that
arrives named `.jpg` is stored as a PNG.

### `PUT /api/v1/admin/vehicles/{vehicle_id}/images/order`

Sets the complete display order. The body is the **whole** list of image ids:

```json
{ "image_ids": ["...", "...", "..."] }
```

A partial list, a repeated id, or an id belonging to another vehicle is a
**422**. A partial order is ambiguous the moment two people reorder the same
gallery at once - the second request would be resolving a move against an order
the first had already replaced.

### `POST /api/v1/admin/vehicles/{vehicle_id}/images/{image_id}/primary`

Promotes one image to position `0` and shifts the rest down, keeping their
relative order. A no-op when the image is already primary.

### `DELETE /api/v1/admin/vehicles/{vehicle_id}/images/{image_id}`

Removes one image and renumbers the rest contiguously from `0`, so deleting the
lead promotes the next one instead of leaving a hole where the hero should be.
Returns the remaining gallery.

**200** with `{"deleted": "<id>", "images": [...]}`. Scoped to the vehicle: an id
from another vehicle is a **404**, not a delete.

The row is committed *before* the file is unlinked. That ordering is the whole
point - the other way round, a commit that failed would roll the row back and
leave a live listing pointing at a file that is gone, which is a broken image
rather than a merely untidy one. The reverse failure is an orphaned file with no
row pointing at it, which is invisible to visitors and can be swept up later.

A vehicle may end up with no images. That is a legitimate state - a car awaiting
photography - and the public page renders a placeholder rather than substituting
a picture of a car that is not theirs.

---

## Operating the staff accounts

Accounts are created and controlled from the server shell, never over HTTP. A
registration endpoint would be a permanent, unauthenticated way to mint staff
credentials.

```bash
python -m app.cli create_staff --email you@humera.example --full-name "Your Name"
python -m app.cli list_staff
python -m app.cli set_active --email you@humera.example --no-active
python -m app.cli revoke_sessions --email you@humera.example
python -m app.cli purge_expired_sessions
```

`create_staff` prompts for the password without echoing it. Passwords are hashed
with Argon2id at configurable cost, and re-hashed on next sign-in when the cost
parameters change.

---

## Not implemented

The following do not exist, and no frontend code depends on them:

```
/api/v1/vehicles/{slug}/inquiries   enquiry submission
/api/v1/vehicles/compare            side-by-side comparison
/api/v1/saved-vehicles              customer shortlist        (authenticated)
/api/v1/export-requests             export enquiry
/api/v1/quotes                      quotations                (staff)
```

Filtering on the public list is **implemented** and documented under
`GET /api/v1/vehicles`: `query`, `make`, `body_type`, `fuel`, `transmission`,
`min_price`, `max_price`, `min_year`, `max_year` and `status`, combined with
`AND`. The control that uses them is also implemented: `frontend/app/(marketing)/
inventory/page.tsx` reads the query string through
`frontend/features/vehicles/lib/filters.ts` and `frontend/lib/api/vehicles.ts`
sends the parameters, so the query-string contract above is now the literal
contract the browser produces.

The shape of that loop is worth stating, because it is what keeps the control
honest:

- The form is `method="get"` and there is no client-side filter state, so the
  query string *is* the state of the page. A filtered inventory is a shareable
  address, and the page renders with JavaScript disabled.
- The values in the URL are the ones the visitor typed. A value the parser
  refuses - over a documented limit, a sign, a non-number, an unknown status, an
  inverted range - is reported in place and **not** forwarded, so a mistyped
  filter produces a message rather than a `422` and an empty grid. The two
  sources of truth above, this file and `backend/app/schemas/vehicle.py`, are
  pinned against each other by `features/vehicles/lib/filters.test.ts`.
- Facet options are derived from the published inventory at render time, not
  hard-coded, so an option cannot exist that the endpoint cannot satisfy and a
  recorded value cannot be unreachable. That costs one extra read when a filter
  is active; a dedicated facets endpoint is the answer if it ever matters.

Still absent, and worth stating because they are the natural next requests:
sorting, free-text relevance ranking, and any query against the `features`
JSONB column.

Frontend code reaches the API only through typed wrappers in
`frontend/lib/api/`. Adding a new resource means adding a module there, not
calling `fetch` from a component.
