# Humera Automobile

Production foundation for the Humera Automobile platform - a Dubai-based
automobile sales and international vehicle-export business.

**Status: Step 1 complete - technical foundation only.** The public website,
vehicle inventory, enquiry flows, customer accounts and admin dashboard are
**not built yet**. See [Current status](#12-current-status) for exactly what
exists.

---

## Contents

1. [Overview](#1-overview)
2. [Architecture](#2-architecture)
3. [Technology stack](#3-technology-stack)
4. [Folder structure](#4-folder-structure)
5. [Prerequisites](#5-prerequisites)
6. [Local setup](#6-local-setup)
7. [Running the backend](#7-running-the-backend)
8. [Running the frontend](#8-running-the-frontend)
9. [Environment variables](#9-environment-variables)
10. [Database and migrations](#10-database-and-migrations)
11. [Development rules](#11-development-rules)
12. [Current status](#12-current-status)
13. [Troubleshooting](#13-troubleshooting)

---

## 1. Overview

The platform will eventually support new, used, luxury, SUV, pickup and
commercial inventory; vehicle search and advanced filtering; individual vehicle
pages; comparison and shortlisting; WhatsApp, phone and form enquiries; vehicle
sourcing and sell-your-car requests; international export with quotations;
customer accounts; and an admin dashboard with lead/CRM management.

None of that is implemented yet. Step 1 establishes the architecture, tooling,
design system and database foundation so those features can be added cleanly,
with each layer verified before the next depends on it.

**What this repository is not:** not a demo, not a template, not a mockup. There
is no seed data, no fake vehicles, no invented testimonials, reviews, prices or
statistics anywhere in it.

---

## 2. Architecture

A two-application monorepo with a hard boundary between the browser-facing
frontend and the backend that owns all data.

```
Browser
   |
   |  HTTPS
   v
frontend/   Next.js 16 App Router (React 19, TypeScript strict, Tailwind v4)
   |        Server Components fetch the API from Node
   |  fetch /api/v1/*
   v
backend/    FastAPI + SQLAlchemy 2 (async)
   |        layered: api -> schemas -> services -> repositories -> db
   v
PostgreSQL 17  (schema owned by Alembic migrations)
```

The browser never talks to the database. The backend never renders HTML. Full
rationale, including the entity plan for inventory, CRM and export, is in
[`docs/architecture.md`](docs/architecture.md).

### Backend layering

Strictly one-directional; each layer may import the one below it, never above.

| Layer | Responsibility | Must not |
| --- | --- | --- |
| `api/` | Routing, status codes, request parsing | Touch the database |
| `schemas/` | Pydantic request/response contracts | Contain business logic |
| `services/` | Business logic | Import FastAPI request/response types |
| `repositories/` | All SQLAlchemy queries | Contain business logic |
| `db/` | Engine, sessions, models | Contain feature logic |
| `core/` | Config, logging, security, errors, middleware | Depend on the layers above |

---

## 3. Technology stack

### Frontend

| Technology | Version | Purpose |
| --- | --- | --- |
| Next.js | 16.3.6 | App Router, routing, SSR/SSG, metadata API |
| React | 19.2.8 | UI runtime |
| TypeScript | 5.x | `strict: true` + `typedRoutes` |
| Tailwind CSS | 4.x | CSS-first design tokens, no config file |
| ESLint | 9.x | Linting (`next lint` was removed in Next 16) |

### Backend

| Technology | Version | Purpose |
| --- | --- | --- |
| Python | 3.12 | Runtime |
| FastAPI | 0.141.1 | ASGI framework, OpenAPI generation |
| Uvicorn | 0.54.0 | ASGI server |
| Pydantic | 2.13.5 | Validation and settings |
| pydantic-settings | 2.15.0 | Typed environment configuration |
| SQLAlchemy | 2.1.1 | Async ORM |
| Alembic | 1.20.0 | Migrations |
| asyncpg | 0.31.0 | PostgreSQL async driver (application) |
| psycopg | 3.3.6 | PostgreSQL sync driver (Alembic) |
| pwdlib + argon2-cffi | 0.3.1 | Argon2id password hashing |
| PyJWT | 2.15.0 | Signed access/refresh tokens (primitives only) |
| aiosqlite | 0.22.1 | Local fallback / isolated tests only |

### Tooling

| Tool | Purpose |
| --- | --- |
| ruff | Backend lint + format, strict rule set incl. bandit |
| mypy | `--strict` type checking |
| pytest + pytest-asyncio | Backend tests (29 passing) |

### Dependency policy

Every dependency earns its place; nothing was added for popularity.

- **`pwdlib` instead of `passlib`** - `passlib` is unmaintained; `pwdlib` is its
  maintained successor and is what FastAPI's own documentation recommends.
- **stdlib `logging` instead of `structlog`** - a JSON formatter and a filter
  cover the requirement without another dependency.
- **No `clsx` / `tailwind-merge`** - `lib/cn.ts` is 20 lines. Revisit only if a
  component genuinely needs runtime conflict resolution.
- **`psycopg` alongside `asyncpg`** - required, not redundant: the app runs async,
  Alembic runs sync.
- **`aiosqlite`** - only so the backend can boot, and tests can run in
  isolation, before PostgreSQL is provisioned. Not for production data.

---

## 4. Folder structure

```
humera-automobile/
├── backend/
│   ├── app/
│   │   ├── main.py                 application factory + ASGI entrypoint
│   │   ├── core/
│   │   │   ├── config.py           typed settings, single source of truth
│   │   │   ├── context.py          request-scoped ContextVars
│   │   │   ├── errors.py           error types + central handlers
│   │   │   ├── logging.py          structured logging
│   │   │   ├── middleware.py       correlation ID, security headers
│   │   │   └── security.py         Argon2id, sessions, JWT primitives
│   │   ├── api/
│   │   │   ├── router.py           aggregates all API versions
│   │   │   ├── deps.py             reusable FastAPI dependencies
│   │   │   └── v1/
│   │   │       ├── router.py       v1 aggregation
│   │   │       └── endpoints/      health.py
│   │   ├── db/
│   │   │   ├── base.py             declarative Base + mixins
│   │   │   ├── database.py         engine, sessions, health check
│   │   │   └── models/
│   │   │       ├── __init__.py     model registry (Alembic reads this)
│   │   │       └── user.py         the only table so far
│   │   ├── schemas/health.py       Pydantic contracts
│   │   ├── services/health.py      health logic, framework-agnostic
│   │   ├── repositories/base.py    generic CRUD primitives
│   │   └── utils/pagination.py     shared pagination contract
│   ├── alembic/
│   │   ├── env.py                  reads URL from app settings
│   │   ├── script.py.mako
│   │   └── versions/               migration history
│   ├── alembic.ini
│   ├── pyproject.toml              canonical deps, ruff, mypy, pytest
│   ├── requirements.txt            pinned runtime deps
│   ├── requirements-dev.txt        pinned dev deps
│   └── tests/                      29 tests
│
├── frontend/
│   ├── app/
│   │   ├── layout.tsx              root layout: html, body, shell, skip link
│   │   ├── globals.css             design tokens (Tailwind v4 @theme)
│   │   ├── page.tsx                technical placeholder
│   │   ├── error.tsx               route error boundary
│   │   ├── global-error.tsx        root-layout fallback
│   │   ├── not-found.tsx           404
│   │   ├── system-status/          live diagnostic page
│   │   └── system/design/          internal, noindex component showcase
│   ├── components/
│   │   ├── ui/                     Container, Surface, Badge, Button, Field,
│   │   │                           Card, state components, button-styles.ts
│   │   ├── layout/                 site-header, site-footer, nav-list, mobile-nav
│   │   ├── brand/                  logo.tsx (wordmark + monogram)
│   │   ├── cta/                    whatsapp-cta, contact-actions
│   │   └── icons.ts                the only lucide-react import
│   ├── config/site.ts              verified business facts, optional channels
│   ├── navigation/
│   │   ├── config.ts               every nav item, live or planned
│   │   └── active.ts               active-route matching
│   ├── features/
│   │   ├── system-status/          feature-scoped components
│   │   └── design-system/          showcase sections
│   ├── lib/
│   │   ├── env.ts                  validated environment access
│   │   ├── cn.ts                   className joiner
│   │   ├── whatsapp.ts             link construction + refusal rules
│   │   └── api/                    client.ts, errors.ts, health.ts
│   ├── fonts/                      self-hosted WOFF2 subsets + OFL licence
│   ├── types/api.ts                API contract types
│   ├── public/
│   ├── scripts/check-contrast.mjs  token contrast audit
│   ├── .env.example
│   ├── next.config.ts              typedRoutes, image formats
│   ├── eslint.config.mjs
│   ├── postcss.config.mjs
│   └── tsconfig.json               strict mode
│
├── docs/
│   ├── architecture.md             full architecture + future direction
│   ├── design-system.md            tokens, components, shell conventions
│   ├── database.md                 schema, migrations, planned entities
│   └── api.md                      endpoints, conventions, errors
│
├── .env.example
├── .gitignore
└── README.md
```

### Deliberate deviations

- **No `frontend/styles/`.** Next requires global CSS in the root layout.
  Design tokens live in `app/globals.css` as the single source of truth; a
  second file would create duplication with no benefit.
- **No `frontend/hooks/` yet.** Created when there is real hook logic. An empty
  folder is misleading.
- **No `features/` subfolders for unbuilt features.** Same reasoning.
- **No root `package.json` / workspace file.** The two applications have no shared
  dependencies, so a workspace would add indirection without benefit. Add one if
  that changes.
- **No test framework in `frontend/`.** Unit tests run on Node's built-in
  runner using native TypeScript, so there is nothing to install. The tested
  modules are deliberately dependency-free to keep that possible. The backend
  keeps `pytest`, which is the right tool there. This is why `engines.node` is
  `>=24.0.0` rather than Next's own `>=20.9.0`: unflagged TypeScript type
  stripping in `node --test` landed in Node 23.6, and on Node 20 the test step
  of `npm run verify` would fail.
- **No headless UI library for the drawer.** ~100 lines of hand-written focus
  management beats a dependency that ships its own React and state model, in a
  site that will otherwise ship very little client JavaScript.

---

## 5. Prerequisites

| Tool | Version | Check |
| --- | --- | --- |
| Python | 3.12+ | `python --version` |
| Node.js | 24+ | `node --version` |
| PostgreSQL | 14+ (17 recommended) | `psql --version` |
| npm | 10+ | `npm --version` |

Optional: Docker, if you prefer to run PostgreSQL in a container.

---

## 6. Local setup

```bash
git clone <repository-url>
cd humera-automobile
```

### 6.1 Environment

```bash
# Repository root - read by the backend
cp .env.example .env

# Frontend - read by Next.js from the frontend/ directory
cp frontend/.env.example frontend/.env.local
```

Then edit `.env` and set at least:

```dotenv
SECRET_KEY=<at least 32 random characters>
DATABASE_URL=postgresql+asyncpg://humera:<password>@localhost:5432/humera_automobile
```

Generate a secret with:

```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

> **Never commit `.env` or `frontend/.env.local`.** Both are git-ignored;
> `.env.example` files are committed.

### 6.2 Database

```sql
CREATE ROLE humera WITH LOGIN PASSWORD 'your-dev-password' CREATEDB;
CREATE DATABASE humera_automobile OWNER humera ENCODING 'UTF8';
```

Or with Docker:

```bash
docker run -d --name humera-postgres `
  -e POSTGRES_USER=humera `
  -e POSTGRES_PASSWORD=your-dev-password `
  -e POSTGRES_DB=humera_automobile `
  -p 5432:5432 postgres:17-alpine
```

### 6.3 Backend dependencies

```bash
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1        # Windows
# source .venv/bin/activate         # macOS / Linux
pip install -r requirements-dev.txt
```

### 6.4 Frontend dependencies

```bash
cd frontend
npm install
```

### 6.5 Apply migrations

```bash
cd backend
alembic upgrade head
alembic check        # expect: No new upgrade operations detected.
```

---

## 7. Running the backend

```bash
cd backend
.\.venv\Scripts\Activate.ps1

uvicorn app.main:app --reload                 # development
uvicorn app.main:app --host 0.0.0.0 --port 8000   # network-accessible
```

Verify it is up:

```bash
curl http://localhost:8000/api/v1/health
curl http://localhost:8000/api/v1/health/ready
```

Interactive API docs: <http://localhost:8000/docs>

Run the checks:

```bash
ruff check app tests alembic     # lint
ruff format --check app tests    # format
mypy app                          # strict types
pytest                            # 29 tests
```

---

## 8. Running the frontend

```bash
cd frontend
npm run dev
```

Open <http://localhost:3000>. Useful routes:

| Route | Purpose |
| --- | --- |
| `/` | Technical placeholder stating what is and is not built |
| `/system-status` | Live diagnostic page; calls the real backend |

Run the checks:

```bash
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
npm run build        # production build
npm start            # serve the production build
```

> The backend must be running for `/system-status` to report healthy. If it is
> not, the page says so explicitly rather than failing silently.

---

## 9. Environment variables

### Backend (repository root `.env`)

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `APP_NAME` | No | `Humera Automobile API` | Service name in logs and OpenAPI |
| `APP_ENV` | No | `development` | `development` / `test` / `staging` / `production` |
| `APP_VERSION` | No | `0.1.0` | Reported by the health endpoint |
| `DEBUG` | No | `false` | Must be `false` in production |
| `DATABASE_URL` | **Yes** | - | Async SQLAlchemy URL (`postgresql+asyncpg://...`) |
| `DATABASE_SQL_ECHO` | No | `false` | Log every statement; development only |
| `SECRET_KEY` | **Yes** | - | Signs sessions/tokens. 32+ chars in production |
| `SESSION_EXPIRE_MINUTES` | No | `10080` | Session lifetime (7 days) |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | No | `15` | Access token lifetime |
| `REFRESH_TOKEN_EXPIRE_DAYS` | No | `7` | Refresh token lifetime |
| `ARGON2_TIME_COST` | No | `3` | Argon2id iterations |
| `ARGON2_MEMORY_COST` | No | `65536` | Argon2id memory, KiB (64 MB) |
| `ARGON2_PARALLELISM` | No | `4` | Argon2id lanes |
| `CORS_ORIGINS` | **Yes** | - | Comma-separated allow-list. No wildcards in production |
| `API_V1_PREFIX` | No | `/api/v1` | Versioned mount point |
| `DOCS_ENABLED` | No | `true` | Set `false` in production |
| `LOG_LEVEL` | No | `INFO` | `DEBUG`..`CRITICAL` |
| `LOG_FORMAT` | No | `console` | `json` in production |
| `NEXT_PUBLIC_API_URL` | No | `http://localhost:8000` | Informational on the backend |
| `NEXT_PUBLIC_SITE_URL` | No | `http://localhost:3000` | Informational on the backend |

### Frontend (`frontend/.env.local`)

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | **Yes** | `http://localhost:8000` | Backend base URL |
| `NEXT_PUBLIC_SITE_URL` | No | `http://localhost:3000` | Canonical site origin |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | No | none | Enquiry number; every WhatsApp CTA is disabled until set |

> `NEXT_PUBLIC_*` values are **inlined into the browser bundle at build time**.
> Never put a secret in one. Changing one requires a rebuild, not just a restart.

> `NEXT_PUBLIC_WHATSAPP_NUMBER` accepts `+971501234567`,
> `00971501234567`, `0501234567` and spaced or bracketed variants. A value
> containing stray characters, or outside E.164 length bounds, is **rejected**:
> CTAs render disabled rather than linking to a number that may not exist. An
> enquiry sent to the wrong number is worse than no enquiry button.

### Production start-up guard

With `APP_ENV=production` the backend **refuses to start** if `SECRET_KEY` is
missing or under 32 characters, `DEBUG=true`, `CORS_ORIGINS` is empty or
contains a wildcard, or `DATABASE_URL` is unset. Each problem is logged
explicitly rather than failing silently.

---

## 10. Database and migrations

```bash
cd backend
```

| Command | Purpose |
| --- | --- |
| `alembic current` | Revision currently applied |
| `alembic upgrade head` | Apply all pending migrations |
| `alembic downgrade -1` | Roll back one revision |
| `alembic downgrade base` | Remove all migrations |
| `alembic revision --autogenerate -m "..."` | Generate from model changes |
| `alembic check` | Fail if models and database have drifted |
| `alembic history` | Show the revision graph |
| `alembic upgrade head --sql` | Print SQL without connecting |

### Adding a model

1. Create `backend/app/db/models/<entity>.py` inheriting `Base`,
   `UUIDPrimaryKeyMixin` and `TimestampMixin`.
2. **Add the class to `ALL_MODELS` in `app/db/models/__init__.py`.** Autogenerate
   cannot see a model that is not imported there.
3. `alembic revision --autogenerate -m "create <entity> table"`
4. **Review the generated file** - autogenerate is a starting point, not a
   guarantee.
5. `alembic upgrade head && alembic check`

Migrations are append-only. Once applied outside your machine, do not edit one;
add another revision instead.

Full detail in [`docs/database.md`](docs/database.md).

---

## 11. Development rules

Enforced by tooling, not convention alone.

### TypeScript

- `strict: true` plus `typedRoutes`. A mistyped `href` is a compile error.
- Server Components by default. `'use client'` only for genuine interactivity -
  currently the two error boundaries, `NavList` and `MobileNav`.
- Components never call `fetch`. Add a typed wrapper in `lib/api/`.
- `<main id="main-content" tabIndex={-1}>` is written once in
  `app/layout.tsx`. Pages render content only.
- Navigation is declared in `navigation/config.ts` and nowhere else.
- `npm run typecheck` and `npm run lint` must pass.

### Python

- Type hints everywhere; `mypy --strict` and `ruff` must pass.
- Route handlers stay thin: parse, delegate, serialise. Business logic lives in
  `services/`, SQL in `repositories/`.
- Raise a typed `AppError`; never return a hand-built error response.
- Never store or log a plaintext password.
- Never silently swallow an exception.

### Security

- No secret in source, in `alembic.ini`, in a response body, or in a log.
- Validate every input on the backend. Client-side validation is UX only.
- Passwords: Argon2id, centrally configured cost.
- Sessions/tokens: store digests, compare in constant time.
- `uploads/` and any user media stay out of version control.

### Design system

- Use the semantic tokens (`bg-page`, `text-fg-secondary`, `border-line`,
  `rounded-card`, ...) rather than raw palette values, so theming stays a token
  swap.
- The brass accent marks **one** primary action per view. It is not decoration.
- Angular, restrained surfaces. No gradients on text, no glassmorphism, no neon,
  no gratuitous animation.
- Accessibility: semantic HTML, a visible focus ring on everything focusable,
  `prefers-reduced-motion` honoured, status conveyed by text as well as colour.

### Git

- Never commit `.env` or `frontend/.env.local`.
- Never commit `node_modules/`, `.venv/`, `.next/` or `__pycache__/`.
- One logical change per commit, with a message that explains *why*.

---

## 12. Current status

### Step 1 - foundation (complete and verified)

| Area | State |
| --- | --- |
| Monorepo structure | Established |
| Backend app | Starts; versioned routing; health endpoints live |
| Configuration | Typed, validated; production start-up guard active |
| Logging | Structured, correlation IDs, console + JSON formatters |
| Error handling | Centralised; one envelope; no swallowed errors |
| CORS | Strict allow-list; wildcards rejected in production |
| Security primitives | Argon2id hashing, session IDs, token primitives, digests |
| Database | PostgreSQL 17; SQLAlchemy 2 async; Alembic configured |
| Schema | 1 table (`users`), 1 migration, verified against live PostgreSQL |
| Tests | 29 backend tests passing |
| Docs | README + architecture + database + API |

### Step 2 - design system (complete and verified)

| Area | State |
| --- | --- |
| Tokens | Colour ramps, semantic + action tokens, type scale, spacing, radius, elevation, motion |
| Dark scheme | First-class, `prefers-color-scheme` driven, contrast-audited |
| Contrast | Every token pairing passes WCAG AA in both schemes, enforced by script |
| Components | Buttons, forms, cards, badges, layout, and a state component for every async view |
| Icons | Single curated re-export; nothing imports `lucide-react` directly |
| Showcase | `/system/design` renders the real components, `noindex` |
| Fonts | Inter + Sora self-hosted, subset WOFF2, OFL licence vendored |

### Step 3 - global shell (complete and verified)

| Area | State |
| --- | --- |
| Layout | One `<main id="main-content">`, skip link, sticky header, footer, mounted once in `app/layout.tsx` |
| Header | Server Component. Desktop nav at `lg`, drawer trigger below |
| Mobile drawer | Focus trap, Escape, scroll lock with scrollbar-width padding, focus restore, `inert` when closed |
| Navigation | Config-driven; every item `live` or `planned`, with unbuilt routes rendered inert rather than as dead links |
| Active state | One shared matcher, unit tested against the two obvious wrong implementations |
| Business facts | Showroom address only. No invented phone, email or social links |
| WhatsApp | Env-driven with strict validation; CTAs disable rather than link to an unverified number |
| Client JS | Two islands only (`NavList`, `MobileNav`); header and footer are server-rendered |

### Not yet built (later steps)

Vehicle inventory, search and filtering; individual vehicle pages; comparison;
shortlisting; enquiry forms; phone hand-off; vehicle sourcing and
sell-your-car requests; export requests and quotations; customer accounts;
authentication screens; admin dashboard; CRM/lead management; SEO content;
deployment and CI/CD.

### Verification evidence

| Check | Result |
| --- | --- |
| `ruff check` | Clean |
| `ruff format --check` | Clean |
| `mypy app` (strict) | Clean, 29 files |
| `pytest` | 29 passed, 0 warnings |
| `alembic upgrade head` | Applied to live PostgreSQL 17.10 |
| `alembic downgrade base` then `upgrade head` | Round trip succeeded |
| `alembic check` | No drift |
| `tsc --noEmit` | Clean |
| `eslint .` | Clean |
| `node --test` | 29 passed (WhatsApp URL rules, active-route matching) |
| `npm run check:contrast` | All token pairings pass AA, light and dark |
| `next build` | Succeeded |
| Rendered route audit | Every route emits exactly one `<main>`, one site `<header>`, one `<footer>` |
| Link audit | No anchor points at an unbuilt route; no `tel:`, `mailto:` or social URL is fabricated |
| `next dev` + live backend | 30/30 end-to-end checks passed |

---

## 13. Troubleshooting

**`GET /api/v1/health/ready` returns `database: "not_configured"`**
`DATABASE_URL` is unset. Copy `.env.example` to `.env` in the repository root and
fill it in. The backend reads the root `.env`, not `backend/.env`.

**`alembic` cannot find `app`**
Run it from `backend/`, so `alembic/env.py` can put the backend root on
`sys.path`.

**`alembic` says "No database configured"**
Same cause as above - `DATABASE_URL` is empty.

**Backend refuses to start with a configuration error**
Expected in `production` when `SECRET_KEY`, `CORS_ORIGINS` or `DATABASE_URL` are
missing or unsafe. The log names each problem.

**Frontend `/system-status` shows failures**
The backend is not running, or `NEXT_PUBLIC_API_URL` is wrong. Remember
`NEXT_PUBLIC_*` is inlined at build time - restart the dev server after changing
it, and rebuild for production.

**`Module not found: Can't resolve '@/...'`**
The `@/*` alias maps to the `frontend/` root. Verify `tsconfig.json` `paths`.

**Port already in use**
`uvicorn` on 8000, Next on 3000. Change with `--port`, or free the port.

**Argon2 errors on a slow machine**
`ARGON2_MEMORY_COST` / `ARGON2_TIME_COST` can be lowered for local development.
Leave production defaults, and benchmark before raising them.

---

## Documentation

| Document | Covers |
| --- | --- |
| [`docs/architecture.md`](docs/architecture.md) | Layering, request lifecycle, error model, future inventory/CRM/export design |
| [`docs/database.md`](docs/database.md) | Schema, conventions, migration workflow, planned entities |
| [`docs/api.md`](docs/api.md) | Endpoints, conventions, error codes, CORS, planned resources |

> `frontend/AGENTS.md` and `frontend/CLAUDE.md` are generated and maintained by
> `next dev`. They document Next.js 16 breaking changes and are regenerated
> automatically - do not hand-edit them.
