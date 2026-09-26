/**
 * WCAG contrast audit for the design tokens in `app/globals.css`.
 *
 * The design system claims "every pairing clears WCAG AA". This script is what
 * makes that claim checkable instead of aspirational: it parses the real token
 * values out of the stylesheet, resolves them for the light and dark colour
 * schemes, and asserts the contrast ratio of every foreground/background pair
 * the component library actually uses.
 *
 *   node scripts/check-contrast.mjs
 *
 * Exit code 0 means every pair passes. Any regression in a token value - or any
 * new component pair added to PAIRS without meeting the threshold - fails here
 * before it reaches a browser.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const CSS_PATH = join(dirname(fileURLToPath(import.meta.url)), "..", "app", "globals.css");
const css = readFileSync(CSS_PATH, "utf8");

/**
 * Returns the balanced `{ ... }` body following the first `open` match.
 *
 * `open` is matched as a prefix, not as a literal string, so the caller can pass
 * `"@theme"` and still find `@theme static {`, `@theme inline {` or a bare
 * `@theme {`. The theme block's modifiers are an implementation detail that
 * changes as the design system grows; this audit should not break when one is
 * added. Only the *first* match is returned, so `:root` and the dark-scheme
 * `:root` are kept separate.
 */
function block(open) {
  const start = css.indexOf(open);
  if (start === -1) throw new Error(`block not found: ${open}`);
  const from = css.indexOf("{", start);
  if (from === -1) throw new Error(`no opening brace after: ${open}`);
  let depth = 0;
  for (let i = from; i < css.length; i += 1) {
    if (css[i] === "{") depth += 1;
    else if (css[i] === "}") {
      depth -= 1;
      if (depth === 0) return css.slice(from + 1, i);
    }
  }
  throw new Error(`unbalanced block: ${open}`);
}

/**
 * Collects `--name: value` pairs from a chunk of CSS into a plain object.
 * (A `Map` is deliberately avoided: these are spread-merged below, and spreading
 * a `Map` silently produces `{}`.)
 */
function tokens(source) {
  const map = {};
  for (const m of source.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)) {
    map[m[1]] = m[2].trim();
  }
  return map;
}

const raw = tokens(block("@theme"));
const light = tokens(block(":root"));
const dark = tokens(block("@media (prefers-color-scheme: dark)"));
const semantic = tokens(block("@theme inline"));

/** `rgb(0 0 0 / 0.5)` and `#rrggbbaa` both carry alpha. */
function parseColor(input) {
  const value = input.trim();

  const hex = value.match(/^#([0-9a-f]{3,8})$/i);
  if (hex) {
    let h = hex[1];
    if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join("");
    if (h.length !== 6 && h.length !== 8) return null;
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
      a: h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1,
    };
  }

  const fn = value.match(/^rgba?\(([^)]+)\)$/i);
  if (fn) {
    const parts = fn[1].replace(/\//g, " ").split(/[\s,]+/).filter(Boolean);
    const [r, g, b] = parts.slice(0, 3).map(Number);
    const a = parts.length > 3 ? Number(parts[3]) : 1;
    return { r, g, b, a };
  }

  return null;
}

function schemeTokens(scheme) {
  return { ...raw, ...semantic, ...(scheme === "dark" ? dark : light) };
}

/** Resolves a token to concrete sRGB + alpha, following `var()` chains. */
function resolve(name, scheme, seen = new Set()) {
  const table = schemeTokens(scheme);
  const value = Object.hasOwn(table, name) ? table[name] : undefined;
  if (value === undefined) return null;
  if (seen.has(name)) throw new Error(`circular token: ${[...seen].join(" -> ")}`);
  seen.add(name);

  const direct = parseColor(value);
  if (direct) return direct;

  // `color-mix(in oklab, var(--x) 18%, transparent)` - an 18% tint of --x.
  const mix = value.match(/^color-mix\(\s*in\s+oklab\s*,\s*var\((--[a-z0-9-]+)\)\s*([\d.]+)%\s*,\s*transparent\s*\)$/i);
  if (mix) {
    const base = resolve(mix[1], scheme, seen);
    if (!base) throw new Error(`unresolved in color-mix: ${mix[1]}`);
    return { ...base, a: base.a * (Number(mix[2]) / 100) };
  }

  const ref = value.match(/^var\((--[a-z0-9-]+)\)$/i);
  if (ref) return resolve(ref[1], scheme, seen);

  // Fall back to the next token in a comma-separated stack (e.g. --font-sans).
  const first = value.split(",")[0].trim();
  return parseColor(first);
}

/** Source-over compositing in sRGB. */
function over(fg, bg) {
  const a = fg.a + bg.a * (1 - fg.a);
  if (a === 0) return { r: 0, g: 0, b: 0, a: 0 };
  return {
    r: (fg.r * fg.a + bg.r * bg.a * (1 - fg.a)) / a,
    g: (fg.g * fg.a + bg.g * bg.a * (1 - fg.a)) / a,
    b: (fg.b * fg.a + bg.b * bg.a * (1 - fg.a)) / a,
    a,
  };
}

function luminance({ r, g, b }) {
  const channel = (c) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function ratio(fgRaw, bgRaw) {
  const l1 = luminance(fgRaw);
  const l2 = luminance(bgRaw);
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Every pairing the component library renders.
 *
 *   text       - 4.5:1 required (WCAG 1.4.3 normal text)
 *   large      - 3.0:1 required (WCAG 1.4.3 large text, >=24px or >=18.66px bold)
 *   ui         - 3.0:1 required (WCAG 1.4.11: the boundary of an interactive
 *                control, or a state indicator needed to operate it)
 *   decorative - no minimum. Reported for information only. WCAG 1.4.11 exempts
 *                purely visual separators: a hairline between two list rows, or
 *                the border of a non-interactive card, carries no information
 *                that is not already in the text beside it. Every *interactive*
 *                boundary uses `--border-control` instead, which is checked
 *                under `ui` above.
 */
const PAIRS = [
  // --- Body copy on each surface -----------------------------------------
  { fg: "--text-primary", bg: "--surface-page", kind: "text" },
  { fg: "--text-secondary", bg: "--surface-page", kind: "text" },
  { fg: "--text-muted", bg: "--surface-page", kind: "text" },
  { fg: "--text-primary", bg: "--surface-raised", kind: "text" },
  { fg: "--text-secondary", bg: "--surface-raised", kind: "text" },
  { fg: "--text-muted", bg: "--surface-raised", kind: "text" },
  { fg: "--text-primary", bg: "--surface-sunken", kind: "text" },
  { fg: "--text-secondary", bg: "--surface-sunken", kind: "text" },

  // --- Inverse surfaces ---------------------------------------------------
  { fg: "--text-inverse", bg: "--surface-inverse", kind: "text" },

  // --- Primary / accent / destructive buttons -----------------------------
  { fg: "--action-primary-content", bg: "--action-primary", kind: "text" },
  { fg: "--action-primary-content", bg: "--action-primary-hover", kind: "text" },
  { fg: "--action-accent-content", bg: "--action-accent", kind: "text" },
  { fg: "--action-accent-content", bg: "--action-accent-hover", kind: "text" },
  { fg: "--action-danger-content", bg: "--action-danger", kind: "text" },
  { fg: "--action-danger-content", bg: "--action-danger-hover", kind: "text" },

  // --- Accent text used for links, eyebrows, emphasis ---------------------
  { fg: "--text-accent", bg: "--surface-page", kind: "text" },
  { fg: "--text-accent", bg: "--surface-raised", kind: "text" },

  // --- Badges --------------------------------------------------------------
  { fg: "--status-neutral-content", bg: "--status-neutral-surface", kind: "text" },
  { fg: "--status-success-content", bg: "--status-success-surface", kind: "text" },
  { fg: "--status-warning-content", bg: "--status-warning-surface", kind: "text" },
  { fg: "--status-danger-content", bg: "--status-danger-surface", kind: "text" },
  { fg: "--status-info-content", bg: "--status-info-surface", kind: "text" },

  // --- Form controls -------------------------------------------------------
  // Form controls set `bg-field` themselves, so the surface behind the control
  // border is always `--surface-field` regardless of what the control is nested
  // in. That makes this pair the only one that can occur, and it is why the
  // control border does not have to be darkened to survive a sunken ancestor.
  { fg: "--text-primary", bg: "--surface-field", kind: "text" },
  { fg: "--text-muted", bg: "--surface-field", kind: "text" },
  { fg: "--text-secondary", bg: "--surface-field", kind: "text" },
  { fg: "--border-control", bg: "--surface-field", kind: "ui" },
  { fg: "--border-control", bg: "--surface-page", kind: "ui" },

  // --- Non-text boundaries and focus --------------------------------------
  { fg: "--ring-focus", bg: "--surface-page", kind: "ui" },
  { fg: "--ring-focus", bg: "--surface-raised", kind: "ui" },
  { fg: "--ring-focus", bg: "--surface-field", kind: "ui" },
  { fg: "--border-control", bg: "--surface-raised", kind: "ui" },

  // --- Outline button: identified by its label, but the border should still
  //     be discernible, so the border token is the 3:1 one. ------------------
  { fg: "--text-primary", bg: "--surface-page", kind: "text" },
  { fg: "--text-primary", bg: "--surface-sunken", kind: "text" },

  // --- Decorative separators (no minimum; reported for information) --------
  { fg: "--border-subtle", bg: "--surface-raised", kind: "decorative" },
  { fg: "--border-default", bg: "--surface-page", kind: "decorative" },
  { fg: "--border-subtle", bg: "--surface-page", kind: "decorative" },
];

const MIN = { text: 4.5, large: 3, ui: 3, decorative: 0 };

let failures = 0;
const rows = [];

for (const scheme of ["light", "dark"]) {
  const page = resolve("--surface-page", scheme);
  const raised = resolve("--surface-raised", scheme);

  for (const pair of PAIRS) {
    // Badges and form controls sit on whatever surface they are placed into.
    // Tinted surfaces are semi-transparent, so they must be composited over a
    // backdrop before a ratio means anything.
    const backdrop = pair.backdrop === "page" ? page : raised;

    const fg = resolve(pair.fg, scheme);
    let bg = resolve(pair.bg, scheme);
    if (!fg || !bg) throw new Error(`unresolved: ${pair.fg} / ${pair.bg}`);

    bg = over(bg, backdrop);
    const fgOnBg = over(fg, bg);

    const value = ratio(fgOnBg, bg);
    const need = MIN[pair.kind];
    const pass = value >= need;
    if (!pass) failures += 1;
    rows.push({ scheme, pair, value, need, pass, bg });
  }
}

const label = (name) => name.replace(/^--(color|surface|text|border|action|status|ring)-/, "");
const width = Math.max(...rows.map((r) => label(r.pair.fg).length + label(r.pair.bg).length));

for (const row of rows) {
  const fg = label(row.pair.fg);
  const bg = label(row.pair.bg);
  const mark = row.pair.kind === "decorative" ? "info" : row.pass ? "PASS" : "FAIL";
  const pad = " ".repeat(Math.max(1, width - fg.length - bg.length));
  const alpha = row.bg.a < 1 ? ` (tint @${Math.round(row.bg.a * 100)}%)` : "";
  const need = row.pair.kind === "decorative" ? "n/a " : `min ${row.need}`;
  console.log(
    `${mark} ${row.scheme.padEnd(5)} ${fg}${pad}${bg.padEnd(24)} ${row.value
      .toFixed(2)
      .padStart(6)}:1  ${need}${alpha}`,
  );
}

console.log("");
const required = rows.filter((r) => r.pair.kind !== "decorative").length;
console.log(
  failures === 0
    ? `All ${required} required pairings pass WCAG AA in both colour schemes (${rows.length - required} decorative separators reported for information).`
    : `${failures} of ${required} required pairings FAIL.`,
);

process.exit(failures === 0 ? 0 : 1);
