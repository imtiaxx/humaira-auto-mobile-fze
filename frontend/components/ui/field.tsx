"use client";

import { createContext, useContext, useId, type ReactNode } from "react";

import { CircleAlert, CircleCheck, Info } from "@/components/icons";
import { cn } from "@/lib/cn";

/**
 * A single field: label, control, help text, error text.
 *
 * `Field` owns the ids and the accessibility wiring so that a control inside it
 * is always correctly associated. This exists because the usual alternative -
 * passing `id`, `aria-describedby` and `aria-invalid` by hand at every call site
 * - is exactly the kind of thing that gets forgotten on the one form that
 * matters, and a label that is not programmatically associated is invisible to a
 * screen reader.
 *
 * Controls (`Input`, `Select`, `Textarea`) read the context. A control that is
 * used without a `Field` still works; it simply has no label, which is why
 * every control accepts an explicit `label` prop as an escape hatch for
 * one-off cases.
 */
type FieldContextValue = {
  /** Id the control must use for its own `id`. */
  controlId: string;
  /** Ids of the help and error nodes, joined for `aria-describedby`. */
  describedBy: string | undefined;
  invalid: boolean;
  required: boolean;
};

const FieldContext = createContext<FieldContextValue | null>(null);

/** Read by controls rendered inside a `Field`. Returns null when standalone. */
export function useField(): FieldContextValue | null {
  return useContext(FieldContext);
}

export type FieldProps = {
  /** Visible label. Always supply one; placeholder text is not a label. */
  label: ReactNode;
  /** Persistent guidance shown below the control. Hidden while invalid. */
  help?: ReactNode;
  /** Validation message. Presence switches the control to its error state. */
  error?: ReactNode;
  /** Marks the control required and adds the asterisk and `required` wiring. */
  required?: boolean;
  /** Hides the label visually while keeping it available to screen readers. */
  hideLabel?: boolean;
  className?: string;
  children: ReactNode;
};

export function Field({
  label,
  help,
  error,
  required = false,
  hideLabel = false,
  className,
  children,
}: FieldProps) {
  const base = useId();
  const controlId = `${base}-control`;
  const helpId = `${base}-help`;
  const errorId = `${base}-error`;

  const invalid = Boolean(error);
  // An error replaces the help text rather than stacking with it, so a field
  // never grows by two lines the moment validation runs.
  const describedBy = invalid ? errorId : help ? helpId : undefined;

  const value: FieldContextValue = { controlId, describedBy, invalid, required };

  return (
    <FieldContext.Provider value={value}>
      <div
        className={cn(
          "flex flex-col gap-1.5",
          // A control must never inherit the width of the column it sits in if
          // that column is a grid track; it fills the field, not the page.
          "min-w-0",
          className,
        )}
      >
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

        {invalid ? (
          <p
            id={errorId}
            role="alert"
            className="flex items-start gap-1.5 text-body-sm text-danger"
          >
            <CircleAlert aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
            <span>{error}</span>
          </p>
        ) : help ? (
          <p id={helpId} className="text-body-sm text-fg-muted">
            {help}
          </p>
        ) : null}
      </div>
    </FieldContext.Provider>
  );
}

/**
 * A standalone group of related controls - a radio group, a checkbox list.
 *
 * Uses `role="group"` with `aria-labelledby` rather than `fieldset`/`legend`
 * because the visual treatment is a compact filter list, not a boxed form
 * section. `Field` remains the right choice when the group is the only thing in
 * a form row.
 */
export function FieldSet({
  legend,
  help,
  error,
  className,
  children,
}: {
  legend: ReactNode;
  help?: ReactNode;
  error?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const base = useId();
  const helpId = `${base}-help`;

  return (
    <fieldset
      // The `<legend>` gives the group its accessible name natively. The help
      // text is associated explicitly so it is announced with the group rather
      // than being read as an unrelated paragraph.
      aria-describedby={help ? helpId : undefined}
      className={cn("flex min-w-0 flex-col gap-2.5 border-0 p-0", className)}
    >
      <legend className="mb-2.5 text-body-sm font-medium text-fg">{legend}</legend>
      {children}
      {error ? (
        <p role="alert" className="flex items-start gap-1.5 text-body-sm text-danger">
          <CircleAlert aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
          <span>{error}</span>
        </p>
      ) : help ? (
        <p id={helpId} className="text-body-sm text-fg-muted">
          {help}
        </p>
      ) : null}
    </fieldset>
  );
}

/**
 * Standalone status line for a form - a submit success message, or an
 * informational note above a group of fields.
 */
export function FormMessage({
  tone = "info",
  children,
  className,
}: {
  tone?: "info" | "success" | "warning" | "danger";
  children: ReactNode;
  className?: string;
}) {
  const TONES = {
    info: { wrap: "text-info", Icon: Info },
    success: { wrap: "text-success", Icon: CircleCheck },
    warning: { wrap: "text-warning", Icon: CircleAlert },
    danger: { wrap: "text-danger", Icon: CircleAlert },
  } as const;

  const { wrap, Icon } = TONES[tone];

  return (
    <p
      // Errors are announced; confirmations are not interruptions but are still
      // read when the user navigates to them.
      role={tone === "danger" ? "alert" : "status"}
      className={cn("flex items-start gap-2 text-body-sm", wrap, className)}
    >
      <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}
