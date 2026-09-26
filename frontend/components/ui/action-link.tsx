import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

import {
  buttonClasses,
  type ButtonSize,
  type ButtonVariant,
} from "@/components/ui/button-styles";

export type ActionTone = ButtonVariant;
export type ActionSize = ButtonSize;

type NativeLinkProps = Omit<ComponentProps<typeof Link>, "className" | "children">;

export type ActionLinkProps = NativeLinkProps & {
  variant?: ButtonVariant;
  /** @deprecated Use `variant`. */
  tone?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children: ReactNode;
};

/**
 * Link styled as a button.
 *
 * A link is used rather than a `<button>` whenever the action navigates, which
 * keeps middle-click, "open in new tab" and keyboard behaviour correct. The
 * styling is imported from the button recipes rather than duplicated, so a
 * variant can never mean one thing on a button and another on a link.
 *
 * `tone` is the historical name for `variant`; both are accepted so existing
 * Step 1 call sites keep working.
 */
export function ActionLink({
  variant,
  tone,
  size = "md",
  className,
  children,
  ...props
}: ActionLinkProps) {
  return (
    <Link className={buttonClasses(variant ?? tone ?? "primary", size, className)} {...props}>
      {children}
    </Link>
  );
}

/**
 * Classes for a link that has to look like a button but cannot be a
 * `next/link` - an external origin, for example the API reference on the
 * foundation page. Kept as a named export because Step 1 call sites use it
 * directly on a plain `<a>`.
 */
export const actionClasses = buttonClasses;
