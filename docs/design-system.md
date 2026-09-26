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

`Stack` and `Cluster` (in `components/ui/stack.tsx`) wrap the flexbox for
vertical and horizontal flow respectively, so gap and wrapping are decided in
one place.

## Colour scheme

Dark mode is a first-class scheme, not an afterthought: it is driven by
`prefers-color-scheme` and is exposed to Tailwind via the `dark:` variant. Every
token has a dark value, and the contrast script validates both. If you add a
token, add both values or the script will tell you.

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
npm run verify        # typecheck, lint, contrast, production build
```

Individually: `npm run typecheck`, `npm run lint`, `npm run check:contrast`,
`npm run build`. Backend checks live in `backend/` (`ruff`, `mypy`, `pytest`).
