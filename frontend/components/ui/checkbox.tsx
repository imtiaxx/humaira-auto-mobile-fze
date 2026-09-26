"use client";

import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/cn";

type NativeCheckboxProps = Omit<ComponentProps<"input">, "className" | "type">;

export type CheckboxProps = NativeCheckboxProps & {
  /** Visible label. */
  label: ReactNode;
  /** Secondary line under the label. */
  description?: ReactNode;
  /** Indeterminate state for a parent whose children are partly selected. */
  indeterminate?: boolean;
  className?: string;
};

const BOX =
  "peer size-4.5 shrink-0 appearance-none rounded-xs border border-line-control bg-field " +
  "transition-colors duration-[var(--duration-fast)] ease-[var(--ease-standard)] " +
  "checked:border-action-primary checked:bg-action-primary " +
  "indeterminate:border-action-primary indeterminate:bg-action-primary " +
  "disabled:cursor-not-allowed disabled:opacity-50";

/**
 * Tick and dash.
 *
 * Two sibling glyphs rather than one element swapping paths, because Tailwind's
 * `peer-*` variants only match siblings of the peer - a descendant of the glyph
 * wrapper cannot react to the input's state. Keeping them as siblings of the
 * input is what makes the swap work with no JavaScript.
 */
const GLYPH =
  "pointer-events-none absolute inset-0 flex items-center justify-center " +
  "text-action-primary-content opacity-0";

/**
 * Checkbox.
 *
 * The row is wrapped in an implicit `<label>`, so the box, the text and the gap
 * between them are all one hit target with no `htmlFor` bookkeeping. The visual
 * box is 18px but a transparent pseudo-element extends the real target to 44px,
 * which is the WCAG 2.5.8 minimum without changing the optical size of the
 * control or adding layout height.
 *
 * The input itself is styled with `appearance-none` rather than hidden, so it
 * stays in the accessibility tree, keeps native keyboard behaviour, and is not
 * `display: none` (which would silently remove it from tab order).
 */
export function Checkbox({
  label,
  description,
  indeterminate = false,
  className,
  disabled,
  ...props
}: CheckboxProps) {
  return (
    <label
      className={cn(
        "group flex min-w-0 items-start gap-2.5",
        disabled ? "cursor-not-allowed" : "cursor-pointer",
        className,
      )}
    >
      <span className="relative flex size-4.5 shrink-0 items-center justify-center after:absolute after:-inset-3 after:content-['']">
        <input
          type="checkbox"
          disabled={disabled}
          // `indeterminate` is a DOM property with no HTML attribute, so it has
          // to be set imperatively.
          ref={(node) => {
            if (node) node.indeterminate = indeterminate;
          }}
          className={BOX}
          {...props}
        />

        <span aria-hidden="true" className={cn(GLYPH, "peer-checked:opacity-100")}>
          <svg viewBox="0 0 12 12" className="size-3" fill="none">
            <path
              d="M2.4 6.3 4.7 8.6 9.6 3.7"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>

        <span aria-hidden="true" className={cn(GLYPH, "peer-indeterminate:opacity-100")}>
          <svg viewBox="0 0 12 12" className="size-3" fill="none">
            <path d="M3 6h6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
          </svg>
        </span>
      </span>

      <span className="flex min-w-0 flex-col gap-0.5">
        <span
          className={cn(
            "text-body-sm text-fg select-none",
            disabled && "opacity-60",
          )}
        >
          {label}
        </span>
        {description ? <span className="text-body-sm text-fg-muted">{description}</span> : null}
      </span>
    </label>
  );
}
