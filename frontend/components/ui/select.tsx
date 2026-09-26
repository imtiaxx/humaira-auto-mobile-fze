"use client";

import type { ComponentProps, ReactNode } from "react";

import { ChevronDown } from "@/components/icons";
import {
  CONTROL_BASE,
  CONTROL_FOCUS,
  CONTROL_INVALID,
  LabelledControl,
  useControlA11y,
  type ControlProps,
} from "@/components/ui/control";
import { cn } from "@/lib/cn";

type NativeSelectProps = Omit<ComponentProps<"select">, "className">;

export type SelectProps = NativeSelectProps &
  ControlProps & {
    /** Only needed outside a `Field`. */
    label?: ReactNode;
    hideLabel?: boolean;
    /**
     * Placeholder rendered as a disabled first option. Useful for a filter
     * ("All makes") where an empty value means "no filter" rather than "unset".
     */
    placeholder?: string;
  };

/**
 * Native `<select>`.
 *
 * Native rather than a custom listbox on purpose: it gets platform pickers on
 * mobile, keyboard type-ahead and screen reader support for free, all of which a
 * hand-rolled combobox has to re-implement badly. The chevron is decorative and
 * `pointer-events-none`, so the control still receives the click.
 *
 * `appearance-none` removes the platform arrow so the custom one can be used
 * without the two overlapping.
 */
export function Select({
  label,
  hideLabel = false,
  placeholder,
  className,
  id,
  describedBy,
  invalid,
  required,
  children,
  ...props
}: SelectProps) {
  const a11y = useControlA11y({ id, describedBy, invalid, required });

  const control = (
    <div className="relative">
      <select
        id={a11y.controlId}
        aria-describedby={a11y.describedBy}
        aria-invalid={a11y["aria-invalid"]}
        required={a11y.required}
        className={cn(
          CONTROL_BASE,
          CONTROL_FOCUS,
          "h-11 appearance-none py-2 pr-10 pl-3 text-body",
          a11y.invalid && CONTROL_INVALID,
          className,
        )}
        {...props}
      >
        {placeholder ? (
          <option value="" disabled>
            {placeholder}
          </option>
        ) : null}
        {children}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-fg-muted"
      />
    </div>
  );

  if (label === undefined) return control;

  return (
    <LabelledControl
      controlId={a11y.controlId}
      label={label}
      hideLabel={hideLabel}
      required={Boolean(a11y.required)}
    >
      {control}
    </LabelledControl>
  );
}
