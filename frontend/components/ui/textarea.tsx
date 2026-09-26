"use client";

import type { ComponentProps, ReactNode } from "react";

import {
  CONTROL_BASE,
  CONTROL_FOCUS,
  CONTROL_INVALID,
  LabelledControl,
  useControlA11y,
  type ControlProps,
} from "@/components/ui/control";
import { cn } from "@/lib/cn";

type NativeTextareaProps = Omit<ComponentProps<"textarea">, "className">;

export type TextareaProps = NativeTextareaProps &
  ControlProps & {
    /** Only needed outside a `Field`. */
    label?: ReactNode;
    hideLabel?: boolean;
  };

/**
 * Multi-line text input.
 *
 * `field-sizing-content` is deliberately *not* used: auto-growing textareas need
 * JS to measure, and a textarea that changes height as you type moves the rest
 * of the form around. A fixed `min-h` plus a resize handle is the more usable
 * behaviour for the long-form fields this site will have (an export enquiry, a
 * message).
 */
export function Textarea({
  label,
  hideLabel = false,
  className,
  id,
  describedBy,
  invalid,
  required,
  rows = 4,
  ...props
}: TextareaProps) {
  const a11y = useControlA11y({ id, describedBy, invalid, required });

  const control = (
    <textarea
      id={a11y.controlId}
      aria-describedby={a11y.describedBy}
      aria-invalid={a11y["aria-invalid"]}
      required={a11y.required}
      rows={rows}
      className={cn(
        CONTROL_BASE,
        CONTROL_FOCUS,
        "min-h-28 resize-y px-3 py-2.5 text-body",
        a11y.invalid && CONTROL_INVALID,
        className,
      )}
      {...props}
    />
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
