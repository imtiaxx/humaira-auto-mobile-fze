import type { ComponentProps, ReactNode } from "react";

import type { LucideIcon } from "@/components/icons";
import {
  buttonClasses,
  type ButtonSize,
  type ButtonVariant,
} from "@/components/ui/button-styles";
import { cn } from "@/lib/cn";

/**
 * A button whose only content is an icon.
 *
 * `label` is required and is not optional-with-a-default, because an icon-only
 * control has no accessible name otherwise: it is announced as just "button".
 * Making it a required prop turns that from a review comment into a type error.
 *
 * The label is rendered as `aria-label` and also as a tooltip via `title`, so it
 * is available to sighted mouse users too. If the control needs a visible text
 * label, use `Button` instead - an icon plus text is usually clearer.
 */
export function IconButton({
  icon: Icon,
  label,
  variant = "ghost",
  size = "md",
  className,
  children,
  ...props
}: {
  icon: LucideIcon;
  /** Accessible name. Also used as the tooltip. */
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  /** Optional visible badge or dot layered on the control. */
  children?: ReactNode;
} & Omit<ComponentProps<"button">, "className" | "aria-label" | "children">) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={buttonClasses(variant, size, cn("px-0", className))}
      {...props}
    >
      <Icon aria-hidden="true" />
      {children}
    </button>
  );
}
