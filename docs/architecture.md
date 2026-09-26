# Architecture

This document explains how Humera Automobile is put together and, importantly,
**which parts exist today and which are only planned**. Nothing described as
"future" is implemented yet.

---

## 1. Overall shape

A two-application monorepo with a hard boundary between the browser-facing
frontend and the backend that owns all data.

```
Browser
   |
   |  HTTPS (browser never talks to the database)
   v
frontend/   Next.js App Router  ──render──>  HTML / RSC payload
   |
   |  fetch  /api/v1/*   (server-side, same-origin or CORS-allowlisted)
   v
backend/    FastAPI  ──SQLAlchemy 2 (async)──>  PostgreSQL
```

The repository root holds no application code. It contains only shared
configuration (`.env.example`, `.gitignore`) and documentation. The two
applications are deployed and scaled independently: the frontend is a static/
SSR Node process, the backend is a stateless API process plus a separate
migration job.

### Why a monorepo rather than a single deployable

The frontend and backend have genuinely different runtimes, scaling profiles and
release cadences. Keeping them in one repository buys atomic refactors across the
API contract (a changed response shape and its consumer land in the same commit)
without coupling their deployment. The coupling that matters - the API contract
- is enforced by types, not by shared deployment.

---

## 2. Frontend architecture

**Location:** `frontend/` &nbsp;|&nbsp; **Next.js 16.3 (App Router), React 19,
TypeScript strict, Tailwind CSS v4**

### Rendering model

Everything in Step 1 is a **Server Component** unless interactivity forces a
client component. There are exactly two `'use client'` files
(`app/error.tsx`, `app/global-error.tsx`) and both are error boundaries, which
Next requires to be client components.

Consequences of this choice, which are intentional:

- The backend URL never needs to be exposed for data fetching; API calls happen
  in Node, so a future private service URL needs no architectural change.
- No API credentials ever enter the browser bundle.
- The JavaScript shipped to a visitor stays close to zero until a genuinely
  interactive feature is added.

### Directory responsibilities

| Path | Responsibility | Rule |
| --- | --- | --- |
| `app/` | Routing, layouts, route-level error/loading boundaries, global CSS | No business logic |
| `components/ui/` | Reusable presentational primitives (`Container`, `Surface`, `Badge`, `SectionHeading`, `ActionLink`) | No data fetching, no domain knowledge |
| `features/` | Feature-scoped components and logic, one folder per feature | May import from `components/ui` and `lib` |
| `lib/api/` | The only place that calls `fetch` | Components never call `fetch` |
| `lib/env.ts` | Validated environment access | `NEXT_PUBLIC_*` must be statically referenced |
| `types/` | Types mirroring the API contract | Mirrors backend schemas |
| `public/` | Static assets served as-is | Never secrets |

**Deliberate omissions.** `hooks/`, `features/` subfolders for not-yet-built
features, and a separate `styles/` directory do not exist yet. They are created
when they hold real code. Design tokens live in `app/globals.css` because Next
requires global CSS to be imported by the root layout, and splitting them into
a second file would create two sources of truth for no benefit.

### API client design

`lib/api/client.ts` is a single `apiGet<T>()` that owns:

- base URL and `/api/v1` prefixing,
- query-string construction,
- a 10-second timeout via `AbortController`,
- correlation IDs forwarded as `X-Request-ID`,
- `cache: "no-store"` (inventory must never be router-cached),
- error normalisation.

Every failure becomes an `ApiError` carrying a `kind` (`network`, `timeout`,
`aborted`, `http`, `parse`), an optional `status`, the backend's machine
`code`, and the backend's `request_id`. `ApiError.userMessage` returns text that
is safe to show a visitor; raw exception text never reaches the UI. Callers
handle one type, so "server said no" and "server unreachable" can never be
confused - a distinction that matters when a customer submits an enquiry form.

### Routing architecture

```
app/
├── layout.tsx            root layout: <html>/<body>, fonts, metadata
├── page.tsx              technical placeholder (NOT the homepage)
├── error.tsx             route error boundary (Next 16 `retry` API)
├── global-error.tsx      root-layout fallback; owns its <html>/<body>
├── not-found.tsx         404
└── system-status/        live diagnostic page
    ├── page.tsx
    └── loading.tsx
```

`/system-status` is a developer diagnostic, not a customer feature. It calls the
real health endpoints and shows real values. It exists to prove the transport
layer, environment configuration and error handling work end to end, and to make
a misconfigured environment obvious in one screen.

**Next 16 specifics that differ from earlier versions** and are already applied:
`params`/`searchParams` are Promises; the error boundary recovery function is
`retry` (not `reset`); `typedRoutes` is a top-level config option; the
`middleware` convention is now `proxy`; `next lint` was removed in favour of
running ESLint directly; Turbopack is the default bundler.

---

## 3. Backend architecture

**Location:** `backend/` &nbsp;|&nbsp; **FastAPI 0.141, Python 3.12, SQLAlchemy
2.1 (async), Alembic 1.20, Pydantic 2.13**

### Layering

Strictly one-directional. Each layer may import the one below it, never the one
above:

```
api/          HTTP concerns only: routing, status codes, request parsing.
              Must not touch the database.
   ↓
schemas/      Pydantic request/response contracts (the public API surface)
   ↓
services/     Business logic. Framework-agnostic: no FastAPI types.
   ↓
repositories/ All SQLAlchemy queries. The only place SQL is written.
   ↓
db/           Engine, session lifecycle, declarative models
```

`core/` is cross-cutting and sits outside the flow: configuration, logging,
security primitives, error types and middleware. Services never import FastAPI
request/response objects, which is what makes them callable from a management
command or a background job later without refactoring.

### Request lifecycle

1. `SecurityHeadersMiddleware` - baseline response headers.
2. `CORSMiddleware` - strict origin allow-list; wildcards are rejected in
   production configuration.
3. `RequestContextMiddleware` - binds a correlation ID to a `ContextVar`,
   emits one structured access log line, records duration.
4. Route handler validates input via Pydantic schemas.
5. Route handler resolves dependencies (`get_db_session`) and calls a service.
6. Service calls a repository, which executes SQL.
7. Any raised `AppError` is converted to the standard error envelope by a
   single centralised handler.

### Error model

Expected failures are raised as `AppError` subclasses (`NotFoundError`,
`ConflictError`, `ValidationError`, `AuthenticationError`,
`PermissionDeniedError`, `ServiceUnavailableError`). One handler renders them:

```json
{
  "error": {
    "code": "not_found",
    "message": "The requested resource was not found.",
    "request_id": "9f3bc7eac05a"
  }
}
```

`request_id` is echoed in the `X-Request-ID` response header, so any visitor-facing
error can be tied to an exact log line. Unhandled exceptions return a generic
message in production; internal details are only included when `DEBUG=true`.

### Configuration

`app/core/config.py` is the single source of truth, loaded through
`pydantic-settings` from the repository-root `.env`. Nothing else reads
`os.environ`. A `Settings.assert_production_ready()` check runs during start-up
and **refuses to boot** if `SECRET_KEY` is missing or short, if `DEBUG` is on,
if `CORS_ORIGINS` is empty or wildcarded, or if `DATABASE_URL` is absent.

### Logging

One root handler, two formatters (`console` for development, `json` for
aggregation), correlation IDs injected into every record via a logging filter,
and uvicorn's loggers re-parented to ours so access and application logs share a
format. `LOG_FORMAT=json` is the production setting.

### Dependency rationale

Only libraries with a concrete job were added. Notable exclusions:
`structlog` (stdlib `logging` plus a JSON formatter covers the requirement), and
`passlib` (unmaintained; `pwdlib` is its maintained successor and is what
FastAPI's own documentation now recommends). `psycopg[binary]` is present
because Alembic runs migrations on a synchronous driver while the application
runs async. `aiosqlite` exists only so the backend can boot and tests can run
in isolation before PostgreSQL is provisioned.

---

## 4. API architecture

**Location:** `backend/app/api/` &nbsp;|&nbsp; Base path `/api/v1`

Versioning is structural, not conventional. `app/api/router.py` aggregates
version modules; `app/main.py` mounts that aggregate once. A breaking change
means adding `v2/` and one `include_router` call - v1 clients are untouched.

**What exists today:** `GET /api/v1/health` and `GET /api/v1/health/ready`, plus
a root discovery document. See `docs/api.md`.

**Planned resource layout** (not implemented): `/vehicles`, `/vehicles/{id}`,
`/vehicles/compare`, `/vehicles/{id}/inquiries`, `/saved-vehicles`,
`/export-requests`, `/quotes`, `/auth/*`, `/admin/*`.

Two endpoint families are deliberately distinct:

- **Public** - browsable without an account. Vehicle search, individual vehicle
  pages, enquiries, export requests, sourcing requests.
- **Admin** - staff only, under `/api/v1/admin`. Inventory management, lead/CRM
  pipeline, quotation management.

---

## 5. Database architecture

**Location:** `backend/app/db/` &nbsp;|&nbsp; PostgreSQL 17, SQLAlchemy 2.1
Declarative, Alembic

See `docs/database.md` for the current schema, migration workflow and the
planned entity model.

Foundation decisions already locked in:

- **UUID v4 primary keys** on every table, so IDs can be created without a
  round trip and never collide across merged environments.
- **Timezone-aware timestamps** on every table (`created_at`, `updated_at`),
  with `updated_at` maintained by the database.
- **Explicit constraint naming** conventions, so autogenerated migrations
  produce stable names and `DROP CONSTRAINT` is safe in production.
- **Async engine for the application, synchronous driver for migrations** -
  Alembic's transactional DDL is simpler and more portable off the event loop.
- **Migrations read the same settings as the application**, so the running app
  and the migration tooling can never disagree about the target database.

### Entities: current and planned

**Implemented (1):** `User` - identity only: email, phone, full name, Argon2id
`password_hash`, `is_active`, `is_staff`, verification and last-login stamps. It
exists so the full model -> migration -> live PostgreSQL chain is proven before
business logic depends on it. It carries no authorisation logic.

**Planned, deliberately not yet modelled:** `Customer`, `Vehicle`,
`VehicleImage`, `VehicleFeature`, `VehicleInquiry`, `SavedVehicle`,
`VehicleComparison`, `ExportRequest`, `Quote`, `Lead`, `Notification`,
`AuditLog`.

These are named in `app/db/models/__init__.py` as the intended set. They are
**not** created yet on purpose: a table, once migrated, is part of the permanent
schema history, and these schemas should be agreed against real business
requirements - Gulf-market vehicle specifications, export destinations, duty
and shipping terms, lead lifecycle stages - before being frozen.

**No seed data, no fake vehicles, no fake statistics.** The database is
designed for real data and currently contains only a schema.

### Future inventory architecture (planned, not built)

`Vehicle` will be the aggregate root, holding specification fields
(brand, model, variant, year, mileage, transmission, fuel, body type, colour,
vin, price, currency, availability), `VehicleImage` as an ordered child set with
a designated primary image, and `VehicleFeature` as a key/value specification
set. `VehicleInquiry`, `SavedVehicle` and `VehicleComparison` reference a
vehicle rather than copying its data, so a price change propagates everywhere
and inventory can never drift between screens.

Filtering will be served by indexed columns on `Vehicle` for the high-cardinality
fields buyers actually filter on (make, body type, fuel, transmission, price
range, year range) with a search index over make/model text. Vehicle list
endpoints will return the shared `Page<T>` envelope already defined in
`app/utils/pagination.py`.

### Future CRM / lead architecture (planned, not built)

Every customer interaction - enquiry, call, WhatsApp message, export request -
becomes a `Lead` with a lifecycle stage (`new` -> `contacted` -> `qualified` ->
`negotiating` -> `won` / `lost`) and an assigned staff member. `VehicleInquiry`
and `ExportRequest` are the two source types. `AuditLog` records state changes
so the pipeline history is reconstructable. `Notification` carries reminders and
follow-ups to staff.

Every one of these will be PII-bearing and access-controlled. The `AuditLog` and
staff-permission model are prerequisites to be designed before the first
customer record is stored, not after.

### Future export workflow (planned, not built)

`ExportRequest` captures the vehicle, the destination country, the customer's
contact details and the intended Incoterm. It progresses to a `Quote` once
staff have priced the shipment (freight, insurance, duties, port handling,
landed cost). `Quote` versions are retained rather than overwritten, because a
customer disputing a landed-cost figure months later is a realistic scenario
for international vehicle export.

Destination-specific duty and shipping data will be modelled as configuration
referenced by the quote calculation, never hard-coded in a service, so figures
can be corrected without a deployment.

---

## 6. Authentication direction (prepared, not implemented)

**No login endpoint, no registration form, no session cookie issuance and no
authentication UI exist yet.** What is in place:

- Argon2id password hashing with centrally configured cost parameters
  (`app/core/security.py`). Plaintext passwords are never stored or logged.
- Transparent hash upgrade: when cost parameters are raised, a stronger digest
  is returned on the next successful verification instead of invalidating
  existing passwords.
- Random opaque session identifiers via `secrets.token_urlsafe(48)`.
- SHA-256 token digests for at-rest storage, so a database disclosure does not
  hand an attacker usable credentials.
- Short-lived signed JWTs with `sub`, `type`, `iat`, `nbf`, `exp` and `jti`
  claims, HS256, with separate access and refresh lifetimes.

None of this is reachable from any endpoint. It is a tested foundation, not a
feature.

**Planned direction:** a server-side session stored in the database with the
opaque identifier in an `HttpOnly`, `Secure`, `SameSite=Lax` cookie, plus
`Authorization: Bearer` access tokens for any non-browser client. The cookie
approach is the default because it is resistant to token exfiltration via XSS;
JWTs exist for machine-to-machine and mobile cases. Browsing public inventory
will not require an account; saved vehicles and request tracking will.

---

## 7. Cross-cutting decisions

**Error handling.** Never swallowed. The backend normalises every failure into
one envelope; the frontend normalises every transport failure into `ApiError`.
Neither layer silently degrades.

**Validation.** Pydantic on the backend for every request; client-side
validation is a UX affordance only and is never treated as a security control.

**Secrets.** One root `.env`, git-ignored, with `.env.example` committed. No
secret appears in source, in `alembic.ini`, or in any response body. The
`SECRET_KEY` and `password_hash` values are `SecretStr`, so they cannot be
accidentally serialised into logs.

**Type safety.** TypeScript `strict: true` plus `typedRoutes`, so a mistyped
`href` is a compile error. Python is fully type-hinted and checked under
`mypy --strict`. Both must pass before a change is considered complete.

**Accessibility.** Semantic HTML first, a visible high-contrast focus ring on
every interactive element, `prefers-reduced-motion` honoured, layout reserved
during loading to prevent shift, and status conveyed by text as well as colour.

**Mobile-first.** Fluid type scale, single-column defaults, touch-sized targets.

---

## 8. What deliberately does not exist yet

No vehicle inventory, search or filtering. No vehicle pages or comparison. No
enquiry, WhatsApp, phone or export forms. No authentication screens. No admin
dashboard. No seed data, testimonials, reviews or statistics. No deployment
configuration, domain, DNS or CI/CD. No payment integration. No AI features.

These are later steps. The recommendation is that they are added in the order
listed in the README, so that each layer is verified before the next depends on
it.
