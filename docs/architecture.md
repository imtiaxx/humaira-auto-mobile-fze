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
├── brands/               brand directory (customer-facing)
│   └── page.tsx
├── compare/              side-by-side vehicle comparison (customer-facing)
│   └── page.tsx
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

`/brands` follows the same rule for the same reason, and is not `/makes`: the
config declares `label: "Brands"` with `path: "/brands"` in the primary nav and
again in the footer's "Vehicles" group, and the site's own word for the
collection is "brands" throughout. Both nav items moved from `status: "planned"`
to `status: "live"` in the same commit that added the route, which is the
one-word promotion `navigation/config.ts` documents and which the generated
`Route` union checks at compile time.

The brand directory is rendered from the same `listVehicles()` call as the
inventory, narrowed to a projection rather than a second query: `brands.ts`
groups published rows by make. It adds no endpoint, no table and no request
parameter, so an option can never appear that the inventory endpoint cannot
satisfy and a recorded make cannot be unreachable - the same property the facets
rely on, for the same reason. Each make links to `/inventory?make=…`, reusing the
filter contract rather than introducing a second vehicle listing, so a car cannot
be rendered under different rules on the directory than on the inventory.

It renders from `features/vehicles/`, whose data flows from a single function,
`listVehicles()`. That function now returns the published rows, so the page
renders real vehicles; when nothing is published - or when a filter matches
nothing - it renders a designed empty state instead. `types/vehicle.ts` mirrors
the `Vehicle` schema so the frontend shape and the database shape cannot drift.

### Vehicle comparison

`/compare` places two to four published vehicles side by side. It is the first
`planned` item in `navigation/config.ts` to reach `status: "live"`, and both the
primary nav item and the footer's "Vehicles" entry were promoted in the same
change, on the terms `/brands` documents. The label is unchanged: the config
calls the destination "Compare Cars" in both places, and `active.test.ts` pins
`/compare` and fails on `/compare-cars`, so the route follows the config.

The selection lives in the query string - `/compare?vehicles=slug-a&vehicles=slug-b`,
with a comma-separated form accepted too - so the page has no client state, works
with JavaScript disabled, and a comparison is a shareable address. This is the
`/inventory` filter contract applied to a selection rather than to a narrowing:
the picker is a native `<form method="get">` and removing a column is a link, so
Back undoes it.

`features/vehicles/lib/compare.ts` holds the parsing, the four-vehicle cap, slug
validation and resolution, and it is the only part with logic worth testing. It
adds no endpoint, no table and no request parameter, for the same reason the brand
directory adds none: the comparison is the published inventory, and
`resolveComparison` is a `filter` over one `listVehicles()` call the page makes
anyway. That is also why it does not call `getVehicleBySlug()` per slug, which
would perform its own list request each time and turn four vehicles into five
round trips.

The query string is the one genuinely untrusted input in the feature, so it is
capped and validated rather than trusted: at most four values are kept, each is
matched against `^[a-z0-9]+(?:-[a-z0-9]+)*$` and a 120-character length cap, and
anything refused is counted and reported on the page rather than silently dropped.
`/api/v1/vehicles/compare` therefore remains unimplemented, and nothing depends on
it.

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
`GET /api/v1/vehicles` and `GET /api/v1/vehicles/{slug}`; a root discovery
document; `/api/v1/auth/{login,logout,me}`; and `/api/v1/admin/vehicles` with its
`/-/summary`, `/{id}`, `/archive`, `/restore` and `/images` routes. See
`docs/api.md`.

The public vehicle routes are **read-only**, `GET`-only by construction: any other
verb returns 405. Every write lives on `/api/v1/admin/*` behind
`require_staff`, so there is no path to publishing a vehicle that an
unauthenticated caller can reach - and, more importantly, no path where one
accidentally appears, because the public and staff routers are separate modules
under separate prefixes. A privileged write cannot be one decorator away from a
public read.

`/-/summary` is declared before `/{vehicle_id}` in `admin_vehicles.py`. FastAPI
matches in declaration order, so a `/{uuid}` route declared first would capture the
literal segment and reject it as an invalid UUID - the dashboard would look broken
for a reason with nothing to do with the dashboard. The `/-/` prefix is a second
guard: no UUID can begin with `-`.

**Not implemented:** `/vehicles/{slug}/inquiries`, `/vehicles/compare`,
`/saved-vehicles`, `/export-requests`, `/quotes`. Public `/vehicles?` filtering
*is* implemented, on the list route only.

The `/compare` page is built and is a frontend projection over the list route, so
it is listed here as an endpoint that does not exist. Nothing calls it: the page
resolves the selection with the one `listVehicles()` read it needs for the picker
anyway. An aggregate endpoint would add a second place that has to remember to
exclude `archived_at IS NULL`, and a comparison that leaked a draft would leak it
beside three real cars where nobody would notice.

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

**Implemented (3):** `User` - identity only: email, phone, full name, Argon2id
`password_hash`, `is_active`, `is_staff`, verification and last-login stamps. It
carries no authorisation logic of its own; roles are checked in the service layer
against the value loaded per request.

**Implemented (2):** `Vehicle` and `VehicleImage` - the inventory read and write
model described below. Both are live and both contain zero rows.

**Implemented (1):** `StaffSession` - `user_id`, the SHA-256 `token_hash`
(uniquely indexed), `expires_at` and `last_used_at`, plus the `created_at` /
`updated_at` stamps from the shared mixin. The plaintext token is never stored, so
a database disclosure does not hand an attacker usable credentials. Sessions are
deleted on sign-out and on expiry rather than flagged, which keeps the table
honest: a row is a live session, full stop.

`expires_at` is enforced on every request rather than by a sweeper, so an expired
session is refused the moment it lapses.
`python -m app.cli purge_expired_sessions` is an operational convenience, not the
mechanism.

`StaffSession` is what makes revocation immediate. Deleting the row is the whole
mechanism, and it is why sessions are stored rather than self-contained.
**The `vehicle_images` position rewrite.** Reordering a gallery permutes values
that a `UNIQUE (vehicle_id, position)` constraint forbids permuting directly, so
rows are written in two phases: first to a range no live row occupies, then to
their real positions. That parking range is *above* `IMAGE_MAX_PER_VEHICLE` and
positive, because `CHECK (position >= 0)` forbids negatives - parking below zero
satisfies the unique constraint and fails the check constraint, which is a
reorder that passes on SQLite and breaks on PostgreSQL.

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
  needs to query *a feature* ("all automatics under 40,000"). The filter control
  on `/inventory` does not fire that trigger: it filters the dedicated columns
  and does not read `features` at all, so the JSONB decision is untouched by
  it.
- **`brand` and `availability` are the column names; `make` and `status` are the
  wire names.** The frontend domain type was written first from the rendered
  requirements, and one vocabulary from the database to the DOM means the
  translation table is empty. `VehicleResponse` bridges the two names with
  `serialization_alias`, so the rename happens once, in one place, covered by
  the backend's own tests.

The same reasoning applies to `vehicles.location`, which is free text rather than
a foreign key: it becomes a `Location` reference when stock is genuinely held at
more than one depot, which is also when a customer would start filtering by it.

Filtering is **not** indexed yet, though the queries that need the indexes now
exist: `GET /api/v1/vehicles` accepts `query`, `make`, `body_type`, `fuel`,
`transmission`, `min_price`, `max_price`, `min_year`, `max_year` and `status`,
and composes them in `vehicle_filter_clauses` in
`backend/app/repositories/vehicle.py`. Facets are case-insensitive equality
expressed as `lower(col) = lower(value)` so a plain btree index is usable; the
free-text term is a substring match over make and model, which is the case that
genuinely needs the trigram index below.

So when the indexes land they will be: btree on `lower(brand)`, `lower(body_type)`,
`lower(fuel)`, `lower(transmission)`, `price` and `year` for the high-cardinality
fields buyers actually filter on, plus a `pg_trgm` GIN index over make/model text
for the substring search. They are deliberately not in the same change as the
queries, because an index is a schema change and bundling the two makes a review
of what a change actually did much harder.

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

## 6. Authentication and staff access (built)

**Staff sign in with an opaque server-side session, not a JWT.** The token is 48
bytes from `secrets.token_urlsafe`, and only its SHA-256 digest is stored in
`staff_sessions`. It is issued once, in an `HttpOnly`, `Secure` (in production),
`SameSite=Lax` cookie; the body also carries it for non-browser clients, which
may send it as `Authorization: Bearer`. The cookie is checked first, so a request
carrying both uses the cookie.

The deciding factor was revocation. A staff account is the account that sometimes
has to be cut off *now* - a stolen laptop, a leaver, a compromised session. A
self-contained JWT cannot be withdrawn before it expires. Deleting the row can:

```bash
python -m app.cli set_active --email leaked@example.com --no-active
python -m app.cli revoke_sessions --email leaked@example.com
```

Both take effect on the very next request.

**There is no registration, and there will not be one over HTTP.** Accounts are
created by an operator with `python -m app.cli create_staff`, which prompts for
the password without echoing it. A registration endpoint would be a permanent,
unauthenticated way to mint staff credentials.

**401 and 403 mean different things and are not collapsed.** 401 is "I do not know
who you are" - no token, or one that is unknown, malformed, expired or revoked.
403 is "I know, and the answer is no" - a valid session belonging to a
deactivated or non-staff account. Collapsing them would make a deactivated account
indistinguishable from a forgotten password, and a client cannot respond to "sign
in again" when the password is not the problem.

**Unknown email and wrong password are indistinguishable**, in message and in
timing. The unknown-account path still runs a password verification so it does not
answer measurably faster, and the sign-in form cannot be used to enumerate which
addresses are staff.

**A JWT implementation exists and is deliberately unused.** `create_token` and
`decode_token` in `app/core/security.py` are tested and reachable from nothing.
Wiring a login route to them would issue tokens that survive `revoke_sessions` and
`set_active`, quietly undoing both. The docstring on `create_token` says so.

`last_used_at` is refreshed at most once every `SESSION_LAST_USED_REFRESH_SECONDS`
(5 minutes), so an operator working normally does not write to the database on every
click.

Passwords are Argon2id at centrally configured cost, and a hash produced under
weaker parameters is transparently upgraded on the next successful verification
rather than invalidating the password.

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

## 8. Staff vehicle and image management (built)

**A withdrawn vehicle is archived, not deleted.** `archive` stamps `archived_at`,
which removes the vehicle from the public list and makes its public page 404, while
the row, its photographs and its edit history all survive. `restore` reverses it
exactly.

This is the decision most likely to look like an omission, so the reasoning is
worth stating. A dealership's inventory is not a scratchpad. A sold car comes back,
a listing was published with the wrong price, a vehicle is withdrawn for a week
while a customer decides. Deletion would mean re-entering the record, re-uploading
the photographs, and losing the fact that it was ever listed. It would also make an
ordinary mistake - a wrong slug, say - irreversible, on data that took real effort
to gather.

Archiving is also the *safer* destructive operation, because it is reversible.
There is no hard delete anywhere in the inventory API, by design.

An archived vehicle stays editable, which is the point: correcting the price of a
car that comes back should not require creating a second record. Archiving twice
returns the *original* `archived_at` rather than a new one, so a double-click
cannot rewrite the moment of withdrawal. `restore` is idempotent for the same
reason.

**Photographs live on the filesystem; their metadata lives in PostgreSQL.**
`vehicle_images` holds position, dimensions, alt text and the storage key. Bytes
are not in the database, because a listing page needs eight of them and the
database should not grow by tens of megabytes per car.

The rules that are load-bearing:

- **The uploaded filename is never part of the storage key.** It is
  attacker-controlled and can carry a traversal sequence, a second extension
  (`car.jpg.php`) or kilobytes of text destined for a URL. Keys are a random
  128-bit hex digest, with the extension taken from the format Pillow *detected*
  and the directory sharded by month.
- **The bytes decide the format, not the filename or the declared content type.**
  Everything is decoded before any byte is written, and only JPEG, PNG and WebP
  are accepted. A GIF/PHP polyglot is a valid GIF to a decoder and a script to a
  misconfigured server; refusing every format outside the allowed three closes that
  at the door.
- **A batch is all or nothing.** One bad file rejects the whole request, storing
  none of them. A partial upload would leave the caller believing it had failed
  while the gallery had silently changed, and would leave orphaned files no row
  points at.
- **Alt text is required and is never invented.** Deriving a description from the
  vehicle name produces a description that is confidently wrong.
- **EXIF is stripped by re-encoding**, so a photograph cannot carry a GPS fix or a
  device serial number onto the public site.
- **Deleting an image commits the row before unlinking the file.** The other order
  looks equivalent and is not: a commit that fails would roll the row back and
  leave a live listing pointing at a file that is gone - a broken image. The
  reverse failure is an orphaned file with no row pointing at it, which is
  invisible to visitors and can be swept up later. `delete_image` therefore does
  not touch the filesystem at all; it returns the key for the caller to unlink
  after committing.
- **Position 0 is the primary photograph**, and it is the only representation of
  that fact. There is no `is_primary` column, because two sources of truth for one
  attribute is two things that can disagree.
- **Reorder takes the whole list.** A partial order is ambiguous the moment two
  people reorder the same gallery concurrently.

A vehicle may end up with no images. That is a legitimate state - a car awaiting
photography - and the public page renders a placeholder rather than substituting a
picture of a car that is not theirs.

---

## 9. What deliberately does not exist yet

Vehicle **filtering** exists on the public list, and so does the **control** for
it. `GET /api/v1/vehicles` accepts `query`, `make`, `body_type`, `fuel`,
`transmission`, price and year bounds, and `status`; `/inventory` renders those
parameters as a `method="get"` form, so the query string is the state of the page
and the page needs no JavaScript to filter. Facet options are derived from the
published rows at render time rather than hard-coded, so an option can never
exist that the endpoint cannot satisfy.

Sorting and relevance ranking do not exist. The staff list is still unfiltered
and always includes archived vehicles, so an editor can find the car they are
trying to restore. No vehicle comparison, enquiry, WhatsApp, phone or export
forms. No saved vehicles or shortlist, and therefore **no customer accounts** -
staff authentication exists, customer authentication does not. No quotations,
CRM or lead management. No testimonials, reviews or statistics. No deployment
configuration, domain, DNS or CI/CD. No payment integration. No AI features.

**The inventory now holds published vehicles, so the page is no longer empty.**
An unfiltered `/inventory` renders every non-archived vehicle, and the filter
control is only as good as what it is derived from - the moment a car is
archived or published the dropdowns change on the next request, with no
redeploy and no cache to clear. Two states remain genuinely different, and both
are handled: no published vehicles at all is an empty-inventory state, while a
filter that matched nothing is a no-match state carrying the filters as a
readable summary and a link back to the full inventory. Collapsing those two into
one message would tell a visitor the dealership sold out when it has stock.

Two consequences worth naming, because they are the ones most likely to be
mistaken for bugs:

- A filter that matches nothing renders no vehicle cards, and says so. The
  cause is in the query string, visible in the address bar.
- A value the parser refuses is shown in its field, with the reason, and is not
  sent to the API. The grid behind it therefore shows the *rest* of the
  visitor's search, not an empty page.

These are later steps. The recommendation is that they are added in the order
listed in the README, so that each layer is verified before the next depends on
it.
