# Humera Automobile - Frontend

Next.js 16 (App Router), React 19, TypeScript strict, Tailwind CSS v4.

**Status: Step 3 - global shell.** The design system (Step 2) and the site
chrome that wraps every page (Step 3) are in place: header, footer, responsive
mobile drawer, and a config-driven navigation model. The public website pages,
vehicle inventory and enquiry flows are not built yet.

Every navigation target except `/` is declared `planned` and renders as
inert text, not a link, so there are no dead links anywhere in the site.

Full setup instructions, architecture rationale and status are in the
[repository README](../README.md). This file is a short reference for working
in `frontend/` specifically. The design tokens, component APIs and usage rules
are documented in [docs/design-system.md](../docs/design-system.md).

## Commands

```bash
npm install
npm run dev             # http://localhost:3000
npm run build           # production build
npm start               # serve the production build
npm run typecheck       # tsc --noEmit
npm run lint            # eslint
npm run test            # unit tests (node --test, no test framework dependency)
npm run check:contrast  # WCAG AA audit of every token pairing, light + dark
npm run verify          # all five of the above
```

## Environment

```bash
cp .env.example .env.local
```

Next.js reads `.env*` files from this directory only, not from the repository
root. `NEXT_PUBLIC_*` values are inlined into the browser bundle at build time -
never put a secret in one, and rebuild after changing one.

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Canonical origin, used for metadata and Open Graph URLs |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | Enquiry number in any format `lib/whatsapp.ts` accepts |

`NEXT_PUBLIC_WHATSAPP_NUMBER` is optional and deliberately forgiving about
format, but strict about validity. It is validated at build time, and every
WhatsApp CTA renders as a disabled control when it is absent or unparseable.
A customer enquiry sent to a wrong number is worse than no enquiry button at
all, so a number is never guessed, defaulted or partially parsed.

## Where things go

| Path | Contents |
| --- | --- |
| `app/` | Routes, layouts, error/loading boundaries, `globals.css` |
| `app/layout.tsx` | The one place `<html>`, `<body>`, the shell and the skip link live |
| `app/system/design/` | Internal, `noindex` design-system showcase |
| `app/fonts.ts` | `next/font/local` loaders for the self-hosted Inter and Sora files |
| `components/ui/` | Reusable presentational primitives |
| `components/brand/` | The wordmark; swap for an official asset when one exists |
| `components/cta/` | WhatsApp and contact-channel calls to action |
| `components/layout/` | `site-header`, `site-footer`, `nav-list`, `mobile-nav` |
| `components/icons.ts` | The only place `lucide-react` may be imported from |
| `config/site.ts` | Verified business facts and optional contact channels |
| `features/` | One folder per feature, with its own components and logic |
| `features/design-system/` | Showcase sections rendered from the real components |
| `fonts/` | Vendored WOFF2 subsets and the OFL licence |
| `lib/api/` | The only place `fetch` is called |
| `lib/env.ts` | Validated environment access |
| `lib/whatsapp.ts` | WhatsApp link construction, and the rules for refusing to guess |
| `navigation/config.ts` | Every nav item, with its live/planned status |
| `navigation/active.ts` | Active-route matching, shared by every nav surface |
| `scripts/check-contrast.mjs` | Token contrast audit run by `npm run check:contrast` |
| `types/` | Types mirroring the backend contract |

## Conventions

- Server Components by default. `'use client'` only for real interactivity.
- Components never call `fetch` - add a typed wrapper in `lib/api/`.
- Use the semantic design tokens (`bg-page`, `text-fg-secondary`,
  `border-line`, `rounded-card`) rather than raw palette values, so theming stays
  a token swap.
- Keep `"use client"` off modules that only export class-name recipes.
  `components/ui/button-styles.ts` is separate from `button.tsx` precisely so
  Server Components can call `buttonClasses()`; merging them breaks the build.
- Icons come from `components/icons.ts`, never from `lucide-react` directly.
- A `<button>` does things, a link navigates. Use `ActionLink` for navigation.
- The brass accent marks one primary action per view. It is not decoration.
- `<main id="main-content" tabIndex={-1}>` is written once in `app/layout.tsx`.
  Pages render content only; adding a second `<main>` or a page-level `<footer>`
  to a route is a bug, not a layout.
- Add navigation to `navigation/config.ts`, never inline it in a component. A
  `planned` item is rendered inert, so a route that does not exist yet cannot
  produce a dead link.
- Tests are `node --test` against dependency-free modules. Import with an explicit
  `.ts` extension in test files; Node cannot resolve an extensionless
  TypeScript specifier.
- `npm run verify` must pass before a change is done.

## Next.js 16 notes

This project runs Next.js 16, which has breaking changes relative to earlier
versions. `AGENTS.md` (regenerated by `next dev`, do not hand-edit) points at the
bundled documentation in `node_modules/next/dist/docs/`. The ones that bite most
often:

- `params` and `searchParams` are Promises and must be awaited.
- Error boundaries receive `retry`, not `reset`.
- The `middleware` convention is now `proxy` (`proxy.ts`, `export function proxy`).
- `next lint` was removed; ESLint is invoked directly.
- Turbopack is the default bundler; do not add a `webpack` config.
