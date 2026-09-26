"use client";

import { useId, type ReactNode } from "react";

import { useField } from "@/components/ui/field";
import { cn } from "@/lib/cn";

/**
 * Shared internals for text-entry controls.
 *
 * `field.tsx` deliberately does not import this module, and this module only
 * reads the context `field.tsx` provides - so there is no import cycle, and
 * `Field` stays usable without pulling in the controls.
 */

/**
 * The visual treatment shared by `Input`, `Select`, `Textarea` and
 * `SearchInput`.
 *
 * The control owns its own background (`bg-field`) rather than inheriting it.
 * That is what guarantees a control border is always measured against a known
 * surface, which is the assumption the `--border-control` contrast token relies
 * on - see the invariant documented next to that token in `globals.css`.
 */
export const CONTROL_BASE =
  "w-full min-w-0 rounded-sm border border-line-control bg-field text-fg " +
  "transition-[border-color,box-shadow] duration-[var(--duration-fast)] " +
  "ease-[var(--ease-standard)] " +
  "placeholder:text-fg-muted " +
  "disabled:cursor-not-allowed disabled:border-line disabled:bg-sunken disabled:text-fg-muted";

/**
 * The focus treatment, identical on every control.
 *
 * `focus-visible` rather than `focus`, so a mouse click does not leave a ring
 * behind. The base layer also draws an `outline`; this ring is the softer inner
 * signal that makes the focused field obvious on a busy page.
 */
export const CONTROL_FOCUS =
  "focus-visible:ring-2 focus-visible:ring-(--ring-focus) focus-visible:ring-offset-2 " +
  "focus-visible:ring-offset-(--surface-field)";

/** The invalid variant. Replaces the focus border colour rather than adding to it. */
export const CONTROL_INVALID = "border-danger focus-visible:border-danger";

export type ControlA11yOptions = {
  id?: string;
  describedBy?: string;
  invalid?: boolean;
  required?: boolean;
};

/**
 * Resolves ids and ARIA state for a control, merging its own props with whatever
 * the surrounding `Field` provides. Explicit props always win, so a control can
 * be corrected at the call site without forking the component.
 */
export function useControlA11y({ id, describedBy, invalid, required }: ControlA11yOptions) {
  const field = useField();
  const fallbackId = useId();

  const isInvalid = invalid ?? field?.invalid ?? false;
  const isRequired = required ?? field?.required ?? false;

  return {
    controlId: id ?? field?.controlId ?? fallbackId,
    describedBy: describedBy ?? field?.describedBy,
    invalid: isInvalid,
    "aria-invalid": isInvalid || undefined,
    required: isRequired || undefined,
  };
}

/** Props every text-entry control accepts. */
export type ControlProps = ControlA11yOptions & {
  className?: string;
};

/**
 * Label plus control, for the case where a control is used without a `Field`.
 *
 * All three controls support this so that a single field in a modal does not
 * force the caller to import `Field` as well. Inside a `Field`, this is not
 * used - the field owns the label.
 */
export function LabelledControl({
  controlId,
  label,
  hideLabel = false,
  required = false,
  children,
}: {
  controlId: string;
  label: ReactNode;
  hideLabel?: boolean;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label
        htmlFor={controlId}
        className={cn(
          "text-body-sm font-medium text-fg",
          hideLabel && "sr-only",
          required && "after:ml-0.5 after:text-danger after:content-['*']",
        )}
      >
        {label}
      </label>
      {children}
    </div>
  );
}
