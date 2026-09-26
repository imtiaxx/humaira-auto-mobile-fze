"use client";

import { type ComponentProps, type ReactNode } from "react";

import { FieldSet } from "@/components/ui/field";
import { cn } from "@/lib/cn";
export type RadioOption = {
  value: string;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
};

const DOT =
  "peer size-4.5 shrink-0 appearance-none rounded-pill border border-line-control bg-field " +
  "transition-colors duration-[var(--duration-fast)] ease-[var(--ease-standard)] " +
  "checked:border-action-primary " +
  "disabled:cursor-not-allowed disabled:opacity-50";

const GLYPH =
  "pointer-events-none absolute inset-0 flex items-center justify-center opacity-0";

/**
 * A group of radio options.
 *
 * Radios rather than a `<Select>` when the option count is small and the choices
 * benefit from being visible: a filter bar of three body types is faster to use
 * as radios than as a dropdown, and it is one tap instead of two.
 *
 * Rendered as a real `<fieldset>` with a `<legend>`, which is what gives the
 * group its accessible name and lets a screen reader announce "3 of 4" as the
 * user moves through it.
 */
export function RadioGroup({
  legend,
  name,
  options,
  help,
  error,
  className,
  ...props
}: {
  legend: ReactNode;
  name: string;
  options: readonly RadioOption[];
  help?: ReactNode;
  error?: ReactNode;
  className?: string;
} & Omit<ComponentProps<"input">, "className" | "type" | "name">) {
  return (
    <FieldSet legend={legend} help={help} error={error} className={className}>
      <div className="flex flex-col gap-2.5">
        {options.map((option) => (
          <label
            key={option.value}
            className={cn(
              "flex min-w-0 cursor-pointer items-start gap-2.5",
              option.disabled && "cursor-not-allowed",
            )}
          >
            <span className="relative flex size-4.5 shrink-0 items-center justify-center after:absolute after:-inset-3 after:content-['']">
              <input
                type="radio"
                // The caller's name is used verbatim. Prefixing it to guarantee
                // uniqueness would make the submitted key unpredictable, which
                // breaks reading the value back out of a server action.
                name={name}
                value={option.value}
                disabled={option.disabled}
                className={DOT}
                {...props}
              />
              {/* The selected dot. Drawn as a sibling glyph rather than by
                  fattening the input's border, so the ring keeps a constant
                  weight instead of eating into the control as it changes. */}
              <span aria-hidden="true" className={cn(GLYPH, "peer-checked:opacity-100")}>
                <span className="size-2 rounded-pill bg-action-primary" />
              </span>
            </span>

            <span className="flex min-w-0 flex-col gap-0.5">
              <span
                className={cn(
                  "text-body-sm text-fg select-none",
                  option.disabled && "opacity-60",
                )}
              >
                {option.label}
              </span>
              {option.description ? (
                <span className="text-body-sm text-fg-muted">{option.description}</span>
              ) : null}
            </span>
          </label>
        ))}
      </div>
    </FieldSet>
  );
}
