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
├── page.tsx              homepage
├── error.tsx             route error boundary (Next 16 `retry` API)
├── global-error.tsx      root-layout fallback; owns its <html>/<body>
├── not-found.tsx         404
├── inventory/            vehicles / inventory page (customer-facing)
│   ├── page.tsx
│   └── [vehicleSlug]/     one vehicle in full
│       ├── page.tsx
│       └── not-found.tsx  vehicle-specific 404 for an unknown slug
├── system/design/        design-system showcase (developer-facing)
│   └── page.tsx
└── system-status/        live diagnostic page
    ├── page.tsx
    └── loading.tsx
```

`/inventory` is the vehicles route. It is `/inventory` and not `/vehicles`
because `navigation/config.ts` already declares the destination under that name
and path - the primary nav item is `label: "Inventory"`, and the footer's
"Vehicles" *group* contains an "Inventory" entry pointing at the same path. The
route follows the config rather than introducing a second URL for one page.

It renders from `features/vehicles/`, whose data flows from a single function,
`listVehicles()`. That function currently returns an empty array, so the page
renders a designed empty state; when the `Vehicle` schema in section 5 is agreed
it becomes the one place that changes. `types/vehicle.ts` mirrors that planned
schema so the frontend shape and the database shape cannot drift.

### Vehicle detail

A single vehicle is `/inventory/[vehicleSlug]`, nested under the inventory route
rather than introduced as a parallel `/vehicles/[slug]` tree. A vehicle *is* an
inventory listing seen in full, so the two share a parent, a breadcrumb and a
return path; a second top-level vehicle space would have created a second set of
URLs for the same content and contradicted the vocabulary in
`navigation/config.ts`.

`vehicleSlug` is a stored field on `Vehicle`, not derived from make and model at
render time. A derived slug changes when the make is corrected, which breaks
every link to the vehicle and invalidates the canonical address. A stored slug is
chosen once, so `alternates.canonical` stays trustworthy.

Single-vehicle lookup is `getVehicleBySlug()`, which is `listVehicles()` filtered
by slug - not a second query. A lookup with its own data access could disagree
with the list, producing a grid showing a car the detail page calls missing. It is
wrapped in React's `cache` because the route reads it from both
`generateMetadata` and the page body, and the two must come from the same read.

An unknown slug calls `notFound()`, which returns a real 404 and renders the
segment's own `not-found.tsx` rather than the root one: the useful destination
from a dead vehicle link is the inventory, not the homepage. The page never
states *why* a slug is unknown - sold, withdrawn, mistyped and never-published
are indistinguishable, and asserting a cause would be a claim the data cannot
support.

**Pricing is USD only.** `Vehicle["currency"]` is typed `"USD"` rather than a
general ISO 4217 `string`, so a mapper that receives a figure in another currency
is a compile error instead of a quiet second currency in the UI. There is no
selector, no conversion and no exchange-rate source, because inventing a rate
would be inventing a price. Formatting lives in
`features/vehicles/lib/format.ts` and is shared by the card and the detail page,
so the two cannot disagree about what a vehicle costs. `null` renders as "Price on
request"; `0` is never a substitute for absence.

### The vehicle data seam

The seam is three files, and only the first of them is a decision about *where*
data comes from:

```
lib/api/vehicles.ts              transport: the wire contract, and the endpoint
                                 bindings. No domain types, no validation.
       ↓
features/vehicles/lib/vehicle-schema.ts
                                 boundary: wire JSON → domain `Vehicle`.
                                 Validates, normalises, rejects.
       ↓
features/vehicles/lib/inventory.ts
                                 policy: whether to read a source at all, and
                                 what a failed read means.
```

`listVehicles()` is the single function that knew where vehicles came from. It was
a documented `return []` while the backend had no vehicle endpoint, so the day
real inventory landed the swap would be one line and no call site would move.
That swap is now made:

```ts
export async function listVehicles(): Promise<Vehicle[]> {
  // walks pages, via listVehiclesFromSource(), until the backend is out
}
```

Nothing above that function changed. `VehicleCard`, `VehicleGrid`, the inventory
page and the detail page keep the same props and the same behaviour, which is the
property this layering exists to guarantee. The wire types in
`lib/api/vehicles.ts` did not need to change either, because the backend was
built against them.

**Why `listVehicles()` walks every page instead of asking for one.** The obvious
implementation is a single call returning the first page, and it would be wrong
for a specific reason: `getVehicleBySlug()` looks a vehicle up by filtering that
list. If stock exceeded one page, the detail page would 404 for every vehicle
past the boundary - the grid listing a car and its own detail page calling it
missing, appearing only once the business got busy enough to cause it. So the
seam walks pages until the envelope says there are none. `getVehicleBySlug()`
deliberately still filters the list rather than calling
`GET /vehicles/{slug}`, because two sources for one fact is the problem this
layering exists to prevent; the remote binding is there for the day both callers
move to it together.

**Why a failed read returns nothing rather than what arrived.** A partial list
renders a grid that looks complete and is not, and for a dealer "that is all we
have" is a materially different statement from "we could not reach the inventory
service". One is silently wrong; the other shows the existing empty state, which
is visibly a state rather than a catalogue. So any page failing discards the
whole read. The reason is not lost - `listVehiclesFromSource()` returns it in
`error` for operators.

**Why a hand-written boundary rather than a schema library.** `apiGet<T>`
documents itself as "an assertion, not a check; validate untrusted payloads at
the boundary when endpoints accept input" - and the assertion is the whole
problem. A TypeScript interface is erased at runtime, so once a response comes
over the network, `Vehicle` guarantees nothing. `vehicle-schema.ts` is where the
guarantee is actually made, and it is hand-written to match the precedent of
`lib/whatsapp.ts`: every rule in it has a specific reason attached that a generic
validator could not carry.

**The normalise/reject split.** A field that is present but messy is normalised
(a slug in the wrong case, `0` as a price, a space in a trim level). A field that
would require inventing something is rejected, and the record is dropped. The
test is whether a correct value can be derived from what is already there. A slug
can be lower-cased without inventing anything; an unrecognised availability
status cannot be turned into a real one, so defaulting it to `available` is
refused - that would tell a customer a car is for sale on the strength of a value
the frontend did not understand.

Rejected outright: no id, no usable slug, no make, no model, no plausible model
year, a currency other than USD, an unknown availability state. Everything else
normalises to `null`, which is how the renderers already expect absence - a
missing specification becomes no row, not a dash and not a zero.

A currency other than USD rejects the record rather than converting it. That is
the rule that makes "USD only" enforceable at the boundary instead of merely
documented: a figure this site cannot quote has no honest rendering here.

**Failure degrades, it does not throw.** `apiGet` throws on every failure, and
nothing catches that today because nothing calls it. The first time it is called,
an unhandled rejection would replace the inventory page with the route error
boundary - a momentary backend hiccup taking down a customer-facing page. So
`listVehiclesFromSource()` catches and returns an empty result with `ok: false`
and the `ApiError` attached: the visitor sees the existing empty state, and the
operator still learns the reason. "We have no stock" and "we could not reach the
inventory service" are different facts, and only the business can tell them
apart. Wiring that error to alerting is a deployment concern; the seam now carries
everything it needs.

**Pagination is carried, not discarded.** The backend caps a page at 100 rows
(`MAX_PAGE_SIZE`), so a real inventory will eventually exceed one page.
`listVehiclesFromSource()` returns `total` and `hasNextPage` alongside the
vehicles rather than collapsing to a bare array, so adding pagination to the grid
is a UI change and not a data-layer rewrite. Until then `listVehicles()` returns
the first page, which is correct while the inventory fits in one.

**One vocabulary, wire to DOM.** The wire uses the same field names as the domain
(`make`, not the planned entity's `brand`; `status`, not `availability`), and
translates only what genuinely differs - `body_type` → `bodyType` by casing, and
`mileage_km`, where the unit belongs in the name because an unqualified
`mileage` number is a unit bug waiting to happen. A field renamed on the way
through the seam is a field that can be renamed *wrong*, and the only symptom is
a blank specification row nobody notices. If the database is later built with
`brand` and `availability` columns, that fix belongs in the Pydantic schema's
`alias` - one line, covered by the backend's own tests - rather than spread
across a frontend mapper. **This naming is the one open question in the seam and
should be agreed before the `Vehicle` table is frozen.**

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

**What exists today:** `GET /api/v1/health`, `GET /api/v1/health/ready`,
`GET /api/v1/vehicles` and `GET /api/v1/vehicles/{slug}`, plus a root discovery
document. See `docs/api.md`.

The vehicle routes are **read-only**. They are the only public data endpoints,
and they are `GET`-only by construction: any other verb returns 405. There is no
write path into `vehicles` at all, which is what keeps "publish a vehicle" out of
reach of an unauthenticated caller until `/api/v1/admin/*` and staff permissions
exist.

**Planned resource layout** (not implemented): `/vehicles?` filtering,
`/vehicles/{slug}/inquiries`, `/vehicles/compare`, `/saved-vehicles`,
`/export-requests`, `/quotes`, `/auth/*`, `/admin/*`.

Two endpoint families are deliberately distinct:

- **Public** - browsable without an account. Vehicle search, individual vehicle
  pages, enquiries, export requests, sourcing requests.
- **Admin** - staff only, under `/api/v1/admin`. Inventory management, lead/CRM
  pipeline, quotation management.

Vehicle **writes** belong to the second family. That is why `vehicles` and
`vehicle_images` are live tables with no endpoint able to populate them, and why
the business has to publish stock through a deliberate admin flow rather than by
anyone who can reach the API.

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

**Implemented (2):** `User` - identity only: email, phone, full name, Argon2id
`password_hash`, `is_active`, `is_staff`, verification and last-login stamps. It
exists so the full model -> migration -> live PostgreSQL chain is proven before
business logic depends on it. It carries no authorisation logic.

**Implemented (2):** `Vehicle` and `VehicleImage` - the public inventory read
model described below. Both are live and both contain zero rows.

**Planned, deliberately not yet modelled:** `Customer`, `VehicleFeature`,
`VehicleInquiry`, `SavedVehicle`, `VehicleComparison`, `ExportRequest`, `Quote`,
`Lead`, `Notification`, `AuditLog`.

These are **not** created yet on purpose: a table, once migrated, is part of the
permanent schema history, and these schemas should be agreed against real business
requirements - Gulf-market vehicle specifications, export destinations, duty
and shipping terms, lead lifecycle stages - before being frozen.

**No seed data, no fake vehicles, no fake statistics.** The database is
designed for real data and currently contains only a schema. The vehicle tables
being live does not change this: the business has not published stock, so they
are empty, and the API and frontend both render that emptiness correctly.

### Vehicle inventory architecture (built)

`Vehicle` is the aggregate root, holding specification fields (brand, model,
variant, year, mileage, transmission, fuel, body type, colour, vin, price,
currency, availability, location). `VehicleImage` is an ordered child set where
`position` 0 is the primary photograph - there is no `is_primary` flag, because a
second source of truth for "which image is the hero" is a second thing that can
disagree with the first.

Two decisions are worth stating explicitly, since both differ from the entity
list this section originally sketched:

- **`features` is a JSONB column on `vehicles`, not a `VehicleFeature` table.**
  Features are a flat key/value set that is written and read whole, never
  filtered on, joined or aggregated. Promoting the column to a table is a
  contained migration, and the trigger for doing it is the first filter that
  needs to query a feature ("all automatics under 40,000").
- **`brand` and `availability` are the column names; `make` and `status` are the
  wire names.** The frontend domain type was written first from the rendered
  requirements, and one vocabulary from the database to the DOM means the
  translation table is empty. `VehicleResponse` bridges the two names with
  `serialization_alias`, so the rename happens once, in one place, covered by
  the backend's own tests.

The same reasoning applies to `vehicles.location`, which is free text rather than
a foreign key: it becomes a `Location` reference when stock is genuinely held at
more than one depot, which is also when a customer would start filtering by it.

Filtering is **not** implemented, and no speculative indexes were added for it.
When filtering lands it will be served by indexed columns on `Vehicle` for the
high-cardinality fields buyers actually filter on (make, body type, fuel,
transmission, price range, year range), with a search index over make/model text.
Vehicle list endpoints return the shared `Page<T>` envelope already defined in
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

No vehicle **search or filtering** - the list endpoint returns everything,
newest first, unfiltered by make, body type, price or status. No vehicle
comparison, enquiry, WhatsApp, phone or export forms. No authentication screens
and no staff permissions. No admin dashboard, and therefore **no way to create,
edit or delete a vehicle**: the tables are live but read-only over HTTP. No seed
data, testimonials, reviews or statistics. No deployment configuration, domain,
DNS or CI/CD. No payment integration. No AI features.

**Zero vehicles is the current, correct state.** `vehicles` and `vehicle_images`
exist and are empty, and the frontend renders a real empty state from that. What
is missing is not the data model - it is the admin write path that the business
will use to publish stock, and a customer-facing way to reach it.

Two consequences of the read-only API are worth naming, because they are the
ones most likely to be mistaken for bugs:

- The inventory page is empty **and will stay empty** until an admin route exists.
  Nothing is wrong with it.
- A vehicle that exists in the database is reachable at
  `/inventory/{slug}`, and one that does not is a 404. With no rows, every slug
  is a 404, which is the truthful answer.

These are later steps. The recommendation is that they are added in the order
listed in the README, so that each layer is verified before the next depends on
it.
