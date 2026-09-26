# Design system

The visual language for Humera Automobile, and the rules for using it. Every
value here is defined once in `frontend/app/globals.css` and consumed by
Tailwind v4 through `@theme`. Nothing in this document is a suggestion: if a
value is not listed here, it is not part of the system.

## Principles

1. **Restraint over spectacle.** This is a luxury automotive retailer. Deep
   graphite, generous whitespace, hairline rules, and a single brass accent used
   sparingly. No gradients, glassmorphism, neon, or decorative motion.
2. **One obvious primary action per view.** If two things on a screen both look
   like the main button, neither is.
3. **Brass means "enquire".** The accent colour is reserved for conversion
   actions - enquire, request a quote, contact the team. It is never decorative
   and never used for information.
4. **State is never communicated by colour alone.** Every status pairs colour
   with an icon or a text label.
5. **Tokens, not literals.** No `text-[#1b1f26]` or `bg-[#b98f4e]` in
   components. If a value is needed that is not a token, the token is missing.

## Colour

### Ramps

Raw ramps are reference values only (`--color-ink-*`, `--color-accent-*`,
`--color-success-*`, `--color-warning-*`, `--color-danger-*`, `--color-info-*`).
Components must use the semantic tokens, so that re-theming never requires
touching component code.

### Semantic tokens

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `--surface-page` | near-white | near-black | page background |
| `--surface-raised` | white | `--ink-900` | cards, panels |
| `--surface-sunken` | `--ink-50` | `--ink-1000` | wells, table headers, hover fills |
| `--surface-field` | `--ink-100` | `--ink-900` | form control interiors |
| `--surface-overlay` | white @ 80% | `--ink-900` @ 80% | modals, popovers |
| `--text-primary` | `--ink-900` | `--ink-50` | headings and body |
| `--text-secondary` | `--ink-700` | `--ink-200` | supporting copy |
| `--text-muted` | `--ink-600` | `--ink-300` | captions, metadata |
| `--border-subtle` | `--ink-200` | `--ink-800` | dividers, card edges |
| `--border-default` | `--ink-300` | `--ink-700` | default control borders |
| `--border-strong` | `--ink-400` | `--ink-600` | hover and emphasis |
| `--ring-focus` | `--accent-600` | `--accent-400` | focus ring only |

### Action tokens

| Token | Meaning |
| --- | --- |
| `--action-primary` / `-content` / `-hover` | the single main action; near-black fill |
| `--action-accent` / `-content` / `-hover` | brass conversion action; near-black content |
| `--action-danger` / `-content` / `-hover` | destructive, irreversible actions only |

### Contrast is enforced, not assumed

```bash
cd frontend
npm run check:contrast
```

`frontend/scripts/check-contrast.mjs` resolves the light and dark schemes
(including `color-mix()` and alpha compositing) and checks 66 required pairings
against WCAG AA. It fails the build step if any required pair regresses. Six
decorative separators are reported for information only, because a hairline rule
is not text.

Non-negotiable: form controls use `bg-field`, so `--border-control` is defined
against that surface. Changing one without the other silently breaks input
legibility. The check script catches this.

## Typography

Inter for UI and body copy, Sora for display and headings. Both are self-hosted
as WOFF2 subsets (latin + latin-ext) and loaded through `next/font/local`, so
there is no external font request at build or run time. `frontend/fonts/OFL.txt`
carries the SIL Open Font License.

Use the named scale, never raw sizes:

| Token | Size | Line height | Tracking | Weight |
| --- | --- | --- | --- | --- |
| `--text-display` | `clamp(2.5rem, 1.9rem + 3vw, 4.25rem)` | 1.04 | -0.03em | 600 |
| `--text-h1` | `clamp(2rem, 1.6rem + 2vw, 3rem)` | 1.1 | -0.025em | 600 |
| `--text-h2` | `clamp(1.625rem, 1.42rem + 1.05vw, 2.25rem)` | 1.15 | -0.02em | 600 |
| `--text-h3` | `clamp(1.3125rem, 1.2rem + .55vw, 1.625rem)` | 1.25 | -0.015em | 600 |
| `--text-h4` | 1.1875rem | 1.3 | -0.01em | 600 |
| `--text-body-lg` | 1.0625rem | 1.65 | - | 400 |
| `--text-body` | 1rem | 1.6 | - | 400 |
| `--text-body-sm` | 0.875rem | 1.55 | - | 400 |
| `--text-caption` | 0.75rem | 1.45 | - | 400 |
| `--text-label` | 0.75rem | 1.2 | 0.14em | 600 |
| `--text-btn` | 0.875rem | 1 | 0.005em | 600 |

`--text-label` is the uppercase eyebrow style. Numeric data - prices, odometer
readings, registration years - should carry the `tnum` utility so columns align
and digits do not shift width.

Body copy is capped by `--container-prose` (`68ch`) for readability.

## Spacing and layout

- Base unit: `--spacing: 0.25rem` (4px). All spacing is a multiple.
- `--spacing-gutter: 1.25rem` - horizontal page padding, mobile.
- `--spacing-block: 1.5rem` - between related elements.
- `--spacing-section: 3.5rem` - between page sections, scaling to
  `--spacing-section-lg` (5rem) at `md` and `--spacing-section-xl` (7rem) at
  `xl`. This is what `section-y` applies.
- `--container-page: 80rem` - hard ceiling for all page content.

### Breakpoints

| Name | Min width | Use |
| --- | --- | --- |
| base | `< 640px` | single column, default |
| `sm` | 640px | two-up grids, inline label/control rows |
| `md` | 768px | three-up grids, `--spacing-section-lg`, wider page gutters |
| `lg` | 1024px | four-up grids, side-by-side panels |
| `xl` | 1280px | `--spacing-section-xl`, full gutters; `container-page` caps here at 80rem |
| `2xl` | 1536px | same as `xl`; extra width goes to the gutters, never the measure |

Mobile-first: unprefixed utilities are the phone layout. Always design the base
case first.

### Utilities

- `container-page` - centred page container with fluid gutters.
- `container-prose` - measure-capped container for long-form copy.
- `section-y` - vertical section rhythm that scales with viewport.
- `rule-top` / `rule-bottom` - standard hairline dividers.
- `tnum` - tabular numerals.
- `on-inverse` - re-points the semantic layer at the dark ramp for a subtree,
  so deep surfaces reuse `bg-page` / `text-fg` / `border-line` instead of
  dark-variant pairs. Scoped, not a scheme: the result is the deep canvas in
  both OS schemes. It deliberately leaves `--surface-inverse` and
  `--text-inverse` inherited, which is what keeps `on-inverse on-inverse`
  flattening rather than inverting twice.

`Stack` and `Cluster` (in `components/ui/stack.tsx`) wrap the flexbox for
vertical and horizontal flow respectively, so gap and wrapping are decided in
one place.

## Colour scheme

Dark mode is a first-class scheme, not an afterthought: it is driven by
`prefers-color-scheme` and is exposed to Tailwind via the `dark:` variant. Every
token has a dark value, and the contrast script validates both. If you add a
token, add both values or the script will tell you.

The script checks a third canvas, `inverse`, which models the `on-inverse`
utility. It is not an OS preference, so it resolves from the raw ramps with the
light baseline beneath it, matching what the utility compiles to. A semantic
token that looks fine on light and dark can still fail here, because the deep
ramp needs a brighter foreground and a different step of the border ramp -
which is the entire reason `on-inverse` restates those instead of inheriting
them. `npm run check:contrast` fails the build on any of the three.

## Components

All live in `frontend/components/ui/`. Import icons only from
`frontend/components/icons.ts`, which re-exports a curated set from
`lucide-react`; nothing else may import from `lucide-react` directly.

| Component | Notes |
| --- | --- |
| `Button` | `<button>` only. Variants: `primary`, `accent`, `secondary`, `outline`, `ghost`, `destructive`. Sizes: `sm` (32px, pointer surfaces only), `md` (44px, default), `lg` (48px). `loading` shows a spinner and sets `aria-busy`. |
| `ActionLink` | a link styled as a button. Use for anything that navigates. |
| `buttonClasses` | the shared recipe, in `button-styles.ts`. Deliberately free of `"use client"` so server components can style links as buttons. |
| `IconButton` | icon-only; `label` is required and becomes the accessible name. |
| `Field` | label + control + help/error, with generated IDs wired through `aria-describedby` and `aria-invalid`. |
| `FieldSet` | grouped controls (radios, checkboxes) with a `<legend>`. |
| `Input`, `Select`, `Textarea` | text controls. All inherit font, use `bg-field`, and share focus/invalid rings. |
| `Checkbox` | indeterminate supported; 18px box with an expanded hit area. |
| `RadioGroup` | `name` is passed through verbatim so native grouping and keyboard arrow navigation work. |
| `SearchInput` | controlled or uncontrolled, with a clear button. |
| `Card` | with `CardMedia`, `CardHeader`, `CardTitle`, `CardDescription`, `CardBody`, `CardFooter`. Interactive cards are buttons, not clickable `div`s. |
| `Badge` | status and category labels. Vehicle states map as: Available = success, Reserved = warning, Sold = neutral, New/Featured = accent, Used = info. |
| `Divider` | horizontal or vertical, optionally labelled. |
| `Stack`, `Cluster` | layout flow. |
| `SectionHeading` | heading level 2 or 3 with an optional action slot. |
| `StateBlock`, `EmptyState`, `ErrorState`, `SuccessState`, `Skeleton`, `LoadingState`, `Spinner` | every async view has a defined state. A blank region while loading is a bug. |

### Forms

- One `Field` per control. The label is the accessible name.
- Errors are `role="alert"`, tied to the control, and never colour-only.
- Placeholder text is an example, never a label substitute.
- Required fields are marked in the label with an asterisk, not only via the
  `required` attribute.
- Never disable a submit button as the only validation feedback.

## Shell and navigation

The chrome that wraps every page lives in `frontend/components/layout/` and is
mounted once, in `app/layout.tsx`. Header and footer are Server Components; the
only client code is `NavList` and `MobileNav`, which need the current pathname
and local interaction state.

| Component | Notes |
| --- | --- |
| `SiteHeader` | Server. Sticky, translucent. Desktop nav at `lg`, drawer trigger below it. |
| `SiteFooter` | Server. Four link columns plus the address block. |
| `NavList` | Client. The single client island for active-state; renders desktop, mobile and stacked variants from one list. |
| `MobileNav` | Client. Drawer with focus trap, Escape, scroll lock and focus restore. |
| `Logo` | Text wordmark plus an `HA` monogram. Swap for the official asset when one exists. |

### Navigation is config, and planned routes are inert

`navigation/config.ts` is the only place a nav item is declared. Each item is
either `live` with a real `href`, or `planned` with the `path` it will take.
A `planned` item renders as `<span aria-disabled="true" data-status="planned">`,
never as an anchor.

This is why the site currently has no dead links. The alternative - omitting
unbuilt pages until they exist - makes the header look empty and gives the
visitor no idea what the business does, and rendering them as links produces 404s
that read as a broken site. Inert text plus a `title` says "this is coming"
without promising a page that does not exist.

Adding a route later is a one-word change (`planned` to `live`), and
`navigation/config.ts` is typed against Next's generated `Route` union so a typo
in a live `href` fails `tsc` rather than shipping a 404.

### Active-state matching

`navigation/active.ts` holds the matching rule and is covered by unit tests,
because the two obvious implementations are both subtly wrong:

- `startsWith(href)` marks **Home** active on every page, since every path
  starts with `/`.
- `startsWith(href)` also marks **Compare Cars** active on `/compare-cars` and
  **Sell / Source** active on `/sell-your-car`.

Matching is exact-or-descendant, with a trailing slash treated as the same
route. Every nav surface shares this function, so the header, drawer and footer
can never disagree about which page you are on.

### The drawer

Hand-built rather than pulled from a headless library: a drawer is about a
hundred lines, and a dependency that ships its own React and state model is a
poor trade for a site that will otherwise ship very little client JavaScript. The
part that is genuinely hard - the focus trap - is implemented explicitly.

A drawer that only works for a sighted mouse user is worse than no drawer, so all
six of the classic failures are handled and commented in place: Escape does
nothing, Tab walks into the page behind, focus never moves on open, the page
behind scrolls, focus is lost on close, and the scrim does nothing.

Two details worth preserving if this is ever refactored:

- The drawer's open state is **derived** from the pathname
  (`openedOn === pathname`) rather than stored and reset in an effect. That
  closes it on any navigation - link click, browser back, or a `router.push`
  from anywhere else - with no second render pass, and it satisfies React's
  `set-state-in-effect` rule.
- The scroll lock adds right padding equal to the scrollbar width. Without it
  the page shifts sideways by roughly 15px the instant the drawer opens.

While closed the drawer is `inert` and `invisible`, so it is neither a second
copy of the navigation for a screen reader nor a set of hidden links sitting in
the tab order.

## Motion

Motion is subtle and functional: `--duration-fast` 120ms, `--duration-base`
180ms, `--duration-slow` 280ms, with `--ease-standard` and `--ease-out-soft`.
Entrances use `fade-up`; loading uses `skeleton` or `spin-slow`.

Under `prefers-reduced-motion: reduce`, all animation and smooth scrolling is
disabled. This is a hard requirement, not a progressive enhancement - do not
add a motion that ignores it.

## Accessibility

- Every interactive element has a visible `:focus-visible` ring using
  `--ring-focus`. Never remove it without a replacement.
- Touch targets are at least 44x44px by default (`Button` at `md` is 44px).
  `sm` buttons are for pointer-first surfaces only.
- Colour is never the sole carrier of meaning.
- Landmarks and heading order are correct: one `h1` per page, then `h2`/`h3`
  in order. `SectionHeading` defaults to `h2`.
- The dark scheme and the light scheme both pass AA.

## Showcase

`/system/design` renders every component from the same source the site uses, so
it cannot drift from reality. It is `noindex, nofollow` and is not part of the
public site. It is a review tool, not a marketing page.

If the showcase should never reach a public deployment, gate it in
`frontend/app/system/design/page.tsx` with an environment check or move it out of
the `app/` tree; it is intentionally left reachable so a staging build can be
used to review changes.

## Verification

```bash
cd frontend
npm run verify        # typecheck, lint, unit tests, contrast, production build
```

Unit tests run on Node's built-in runner against dependency-free modules, so
there is no test framework to install and no extra dependency in the bundle.
They cover the two pieces of logic where a silent bug is expensive: WhatsApp
link construction, which must refuse to invent a number, and active-route
matching, which must not light up the wrong link.

Individually: `npm run typecheck`, `npm run lint`, `npm run check:contrast`,
`npm run build`. Backend checks live in `backend/` (`ruff`, `mypy`, `pytest`).
