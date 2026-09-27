# API

Base URL: `http://localhost:8000` &nbsp;|&nbsp; Version prefix: `/api/v1`

**Step 1 exposes two endpoints.** Vehicle inventory, enquiries, export
requests, authentication and admin resources are **not implemented** and will be
added in later steps. Nothing in this document describes planned behaviour as if
it worked.

Interactive documentation is served at `/docs` (Swagger UI) and `/redoc`, with the
raw schema at `/openapi.json`. Both are disabled when `DOCS_ENABLED=false`,
which should be the production setting.

---

## Conventions

**Content type.** JSON in and out, except file uploads in later steps.

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
| `conflict` | 409 | Conflicts with current state, e.g. duplicate email |
| `service_unavailable` | 503 | A dependency is unavailable |
| `internal_error` | 500 | Unexpected failure |

Only `not_found`, `request_validation_error` and `internal_error` are reachable
today.

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
other verb returns **405**. There is no admin or write surface at this stage, so
there is no unauthenticated way to publish a vehicle.

| Query | Type | Default | Notes |
| --- | --- | --- | --- |
| `page` | integer ≥ 1 | `1` | 1-based |
| `page_size` | integer 1–100 | `24` | Maximum 100 (`MAX_PAGE_SIZE`) |

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
- `status` is one of `available`, `reserved`, `sold`. All three are returned;
  there is no filtering yet, so a client that wants only available stock must
  filter the list.
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

Both routes are `GET`-only. A `POST`, `PUT`, `PATCH` or `DELETE` to either
returns **405** with an `Allow: GET` header rather than creating, altering or
removing data. Verified by `test_vehicles_endpoints_are_read_only`.

No endpoint accepts a write payload, so there is no request-body validation
surface here yet. Input validation is limited to what a read needs: the two
pagination bounds and the slug length.

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

The allow-list comes from `CORS_ORIGINS` (comma-separated). `localhost:3000` is
allowed by default for local development. Credentials are permitted, and
`X-Request-ID` and `X-Response-Time-ms` are exposed so the browser can read them.

An origin not on the list is **not** reflected back - verified. A wildcard is
rejected during production start-up.

---

## Planned resources (not implemented)

`/api/v1/vehicles` and `/api/v1/vehicles/{slug}` are now implemented - see
above. The following are **not**, and no frontend code depends on them. They are
listed so the shape of the API is predictable for the frontend.

```
/api/v1/vehicles?make=&body_type=&price_min=&price_max=   filtering (not implemented)
/api/v1/vehicles/{slug}/inquiries   enquiry submission
/api/v1/vehicles/compare            side-by-side comparison
/api/v1/saved-vehicles              customer shortlist        (authenticated)
/api/v1/export-requests             export enquiry
/api/v1/quotes                      quotations                (staff)
/api/v1/auth/*                      registration, sign-in, sign-out, refresh
/api/v1/admin/*                     inventory, leads, CRM     (staff)
```

Two entries deserve a note, because they are the obvious next steps and both
imply a step this one deliberately did not take:

- **Filtering** is a query-string contract. It needs an agreed set of filters
  and their interaction (does `status=available` combine with `body_type`?) before
  it is worth pinning. The list endpoint returns all statuses, unfiltered.
- **`/api/v1/admin/*`** is where vehicle writes will eventually live. It implies
  authentication and authorisation, neither of which exists. Adding a write
  endpoint to the public API now would mean publishing stock through an
  unauthenticated route.

Frontend code reaches the API only through typed wrappers in
`frontend/lib/api/`. Adding a new resource means adding a module there, not
calling `fetch` from a component.
