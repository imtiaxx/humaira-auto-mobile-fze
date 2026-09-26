/**
 * Decorative hero artwork.
 *
 * ---------------------------------------------------------------------------
 * Why this is drawn rather than photographed
 * ---------------------------------------------------------------------------
 * This project currently has no image assets at all - `public/` holds a
 * `.gitkeep` and there is not a single raster or vector file in the repository.
 * So there is no vehicle photography to use, and the alternatives were all bad:
 *
 *   - a grey "image coming soon" box, which reads as an unfinished template
 *   - a stock photo, which would depict a vehicle this business does not stock
 *   - an invented car illustration, which would imply inventory that may not
 *     exist - the exact fabrication this project refuses elsewhere
 *
 * What is drawn here is a technical-drawing motif: arcs, a measurement grid and
 * dimension ticks. It is the visual language of engineering and precision
 * manufacture, which is what an import and export business actually trades on,
 * and it makes no claim about any specific vehicle. It is ornament, and it is
 * marked as such.
 *
 * The honest long-term fix is real photography of real stock. Dropping a photo
 * in means replacing the `<svg>` below and deleting this file's reasoning; no
 * other component needs to change.
 */

/**
 * Purely decorative, so it is hidden from assistive technology and removed from
 * the tab order. `focusable="false"` matters on older IE/Edge SVG handling, where
 * an `<svg>` could otherwise become a focus stop with no accessible name - a
 * keyboard user tabbing through the hero would land on nothing.
 *
 * The wrapper is `aria-hidden` rather than the `<svg>` alone because the whole
 * figure, including its caption-free frame, carries no information.
 */
export function HeroVisual({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={className}>
      <svg
        viewBox="0 0 520 520"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        focusable="false"
        className="block h-auto w-full"
        preserveAspectRatio="xMidYMid meet"
      >
        {/*
          Stroke weights are deliberately uneven. The 1px grid and 1.25px arcs sit
          back as texture; the single 2px accent arc is the focal line. A drawing
          where every line has the same weight reads as noise rather than as
          precision.
        */}
        <defs>
          <clipPath id="hero-visual-frame">
            <rect width="520" height="520" rx="20" />
          </clipPath>

          <linearGradient id="hero-visual-fade" x1="0" y1="0" x2="0" y2="520">
            {/*
              A vertical fade to transparent at the bottom, so the grid dissolves
              instead of stopping at a hard edge. Two stops only, and the
              gradient carries no colour of its own - it just modulates opacity,
              which is why it cannot introduce a hue that fails contrast.
            */}
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.5" />
            <stop offset="55%" stopColor="currentColor" stopOpacity="0.28" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>

        <g clipPath="url(#hero-visual-frame)">
          {/* ---- Measurement grid ------------------------------------------ */}
          {/* 40px module. Drawn as one path rather than 26 lines so the DOM
              stays small; each subpath is a separate grid line. */}
          <path
            stroke="currentColor"
            strokeWidth="1"
            opacity="0.16"
            d="M0 40H520M0 80H520M0 120H520M0 160H520M0 200H520M0 240H520M0 280H520M0 320H520M0 360H520M0 400H520M0 440H520M0 480H520M40 0V520M80 0V520M120 0V520M160 0V520M200 0V520M240 0V520M280 0V520M320 0V520M360 0V520M400 0V520M440 0V520M480 0V520"
          />

          {/* ---- Concentric arcs ------------------------------------------ */}
          {/* A wheelhouse/turbine read. Five arcs sharing a centre at the lower
              left, each larger than the last, so the eye follows them outward. */}
          <g stroke="currentColor" strokeWidth="1.25" opacity="0.34">
            <circle cx="150" cy="400" r="90" />
            <circle cx="150" cy="400" r="150" />
            <circle cx="150" cy="400" r="210" />
            <circle cx="150" cy="400" r="270" />
            <circle cx="150" cy="400" r="330" />
          </g>

          {/* The focal arc. Drawn as an arc segment across the top of the
              largest circle so it reads as a highlight rather than a full
              ring, and given the accent colour plus full opacity.

              `var(--text-accent)` rather than a fixed ramp step: that token is
              redefined inside the `prefers-color-scheme: dark` block, so the
              stroke re-tints with the scheme. Hard-coding `--color-accent-500`
              would leave a mid-brass arc sitting on a near-black background in
              the dark scheme, where it all but disappears. */}
          <path
            d="M0 70 A330 330 0 0 1 330 0"
            stroke="var(--text-accent)"
            strokeWidth="2"
            strokeLinecap="round"
            opacity="0.85"
          />

          {/* A second, shorter accent arc, opposed, to keep the composition from
              reading as a single centred ring. */}
          <path
            d="M520 300 A220 220 0 0 1 300 520"
            stroke="var(--text-accent)"
            strokeWidth="2"
            strokeLinecap="round"
            opacity="0.5"
          />

          {/* ---- Horizon ------------------------------------------------- */}
          {/* The single strongest horizontal in the drawing. It grounds the
              arcs and gives the composition a baseline. */}
          <path stroke="currentColor" strokeWidth="1.25" opacity="0.45" d="M0 400H520" />

          {/* ---- Dimension line ------------------------------------------- */}
          {/* An engineering drawing convention: a measured span with tick ends
              and a witness line. Purely graphic - it is not a chart, and it
              carries no data, which is why it needs no text label and no
              accessible name. */}
          <g stroke="currentColor" strokeWidth="1" opacity="0.4">
            <path d="M80 470H440" />
            <path d="M80 462V478M440 462V478" />
            <path d="M80 400V470M440 400V470" opacity="0.5" />
          </g>

          {/* ---- Nodes ---------------------------------------------------- */}
          {/* Small filled markers where the arcs meet the horizon. These carry
              the "instrumentation" read that the whole motif depends on. */}
          <g fill="var(--text-accent)">
            <circle cx="150" cy="400" r="4" />
            <circle cx="360" cy="400" r="3" opacity="0.7" />
            <circle cx="240" cy="400" r="2.5" opacity="0.5" />
          </g>

          {/* Bottom fade, so the grid dissolves rather than ending abruptly. */}
          <rect y="300" width="520" height="220" fill="url(#hero-visual-fade)" />
        </g>

        {/* ---- Frame ------------------------------------------------------ */}
        {/* Drawn outside the clip so the border stays crisp at the rounded
            corners rather than being cut by it. */}
        <rect
          width="519"
          height="519"
          x="0.5"
          y="0.5"
          rx="19.5"
          stroke="currentColor"
          strokeWidth="1"
          opacity="0.28"
        />
      </svg>
    </div>
  );
}
