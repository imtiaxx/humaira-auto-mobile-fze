import type { ReactNode } from "react";

import {
  CircleCheck,
  Info,
  TriangleAlert,
  type LucideIcon,
} from "@/components/icons";
import { buttonClasses, type ButtonVariant } from "@/components/ui/button-styles";
import { cn } from "@/lib/cn";

export type StateBlockProps = {
  icon: LucideIcon;
  tone?: "neutral" | "info" | "success" | "warning" | "danger";
  title: string;
  description?: ReactNode;
  /** A label plus a variant. Optional: some empty states have no action. */
  action?: { label: string; variant?: ButtonVariant; onClick?: () => void };
  /**
   * `alert` for anything that appears after a user action, so it is announced
   * instead of silently swapping the page content.
   */
  role?: "status" | "alert";
  className?: string;
};

/**
 * A centred message block for "nothing here yet" and "that didn't work".
 *
 * Both states are the same shape on purpose: an icon, a title, an explanation
 * and optionally an action. One component for both means an empty inventory grid
 * and a failed enquiry form occupy the same space and read the same way, and a
 * page cannot accumulate three ad-hoc treatments for the same situation.
 *
 * Note the absence of a surrounding `<Surface>`: this is placed directly by the
 * caller inside whatever region it describes, so it does not add a second box
 * inside a card.
 */
export function StateBlock({
  icon: Icon,
  tone = "neutral",
  title,
  description,
  action,
  role,
  className,
}: StateBlockProps) {
  const TONES = {
    neutral: "bg-sunken text-fg-muted",
    info: "bg-info-surface text-info",
    success: "bg-success-surface text-success",
    warning: "bg-warning-surface text-warning",
    danger: "bg-danger-surface text-danger",
  } as const;

  return (
    <div
      role={role}
      className={cn(
        "flex flex-col items-center gap-3 rounded-card border border-line bg-raised px-6 py-12 text-center",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn("flex size-11 items-center justify-center rounded-pill", TONES[tone])}
      >
        <Icon className="size-5" />
      </span>

      <div className="flex max-w-md flex-col gap-1.5">
        <p className="text-h4 text-fg">{title}</p>
        {description ? (
          <p className="text-body text-fg-secondary text-pretty">{description}</p>
        ) : null}
      </div>

      {action ? (
        <button
          type="button"
          onClick={action.onClick}
          className={buttonClasses(action.variant ?? "outline", "md")}
        >
          {action.label}
        </button>
      ) : null}
    </div>
  );
}

/** "No results" - a filter that matched nothing. */
export function EmptyState(props: Omit<StateBlockProps, "icon" | "tone" | "role">) {
  return <StateBlock icon={Info} tone="neutral" role="status" {...props} />;
}

/** A failure the user can act on. Announced, because it is usually unexpected. */
export function ErrorState(props: Omit<StateBlockProps, "icon" | "tone" | "role">) {
  return <StateBlock icon={TriangleAlert} tone="danger" role="alert" {...props} />;
}

/** A confirmation after a submission. */
export function SuccessState(props: Omit<StateBlockProps, "icon" | "tone" | "role">) {
  return <StateBlock icon={CircleCheck} tone="success" role="status" {...props} />;
}

/**
 * Loading placeholder.
 *
 * A travelling highlight rather than a pulsing opacity, for the reason given in
 * `globals.css`. `aria-hidden`, because the group's accessible name comes from
 * `LoadingState` below - a screen reader should hear "Loading results" once, not
 * a stream of decorative rectangles.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "rounded-sm",
        "animate-skeleton",
        "bg-[length:200%_100%]",
        "bg-[linear-gradient(90deg,var(--color-ink-100)_0%,var(--color-ink-200)_50%,var(--color-ink-100)_100%)]",
        "dark:bg-[linear-gradient(90deg,var(--color-ink-900)_0%,var(--color-ink-800)_50%,var(--color-ink-900)_100%)]",
        className,
      )}
    />
  );
}

/** A labelled group of skeletons, for a list or grid that is still loading. */
export function LoadingState({
  label = "Loading",
  rows = 3,
  className,
}: {
  label?: string;
  rows?: number;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn("flex flex-col gap-3", className)}
    >
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className="h-16 w-full" />
      ))}
    </div>
  );
}

/**
 * A compact inline spinner for a tight row or a button.
 *
 * Decorative. Anything that needs to announce pending work should set
 * `aria-busy` on the control that triggered it, which `Button` does.
 */
export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-block size-4 shrink-0 rounded-pill border-2 border-current border-t-transparent",
        "animate-spin-slow opacity-70",
        className,
      )}
    />
  );
}
