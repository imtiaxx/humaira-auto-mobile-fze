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

type NativeInputProps = Omit<ComponentProps<"input">, "className">;

export type InputProps = NativeInputProps &
  ControlProps & {
    /**
     * Only needed when the input is *not* wrapped in a `Field`; inside one, the
     * field owns the label. A placeholder is never a substitute for a label.
     */
    label?: ReactNode;
    /** Visually hides the label while keeping it for screen readers. */
    hideLabel?: boolean;
  };

/**
 * Text input.
 *
 * `h-11` matches the default button height, so a form row of mixed controls
 * lines up without per-field tweaking.
 */
export function Input({
  label,
  hideLabel = false,
  className,
  id,
  describedBy,
  invalid,
  required,
  ...props
}: InputProps) {
  const a11y = useControlA11y({ id, describedBy, invalid, required });

  const control = (
    <input
      id={a11y.controlId}
      aria-describedby={a11y.describedBy}
      aria-invalid={a11y["aria-invalid"]}
      required={a11y.required}
      className={cn(
        CONTROL_BASE,
        CONTROL_FOCUS,
        "h-11 px-3 text-body",
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
