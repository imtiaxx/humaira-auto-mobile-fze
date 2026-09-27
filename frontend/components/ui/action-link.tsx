import Link from "next/link";
import type { LinkProps } from "next/link";
import type { ReactNode } from "react";

import {
  buttonClasses,
  type ButtonSize,
  type ButtonVariant,
} from "@/components/ui/button-styles";

export type ActionTone = ButtonVariant;
export type ActionSize = ButtonSize;

/**
 * The wrapper's own props, kept separate from the native ones so the two can be
 * told apart where they overlap.
 */
type ActionLinkOwnProps = {
  variant?: ButtonVariant;
  /** @deprecated Use `variant`. */
  tone?: ButtonVariant;
  size?: ButtonSize;
  /**
   * Merged with the button recipe rather than replacing it.
   *
   * `className` is in `LinkProps` too, so it is omitted from the native side and
   * declared here once - otherwise the intersection would make it
   * `string & undefined`.
   */
  className?: string;
  children: ReactNode;
};

/**
 * Link styled as a button.
 *
 * ---------------------------------------------------------------------------
 * Why this is generic in the route
 * ---------------------------------------------------------------------------
 * Because `next/link` is, and the difference matters with `typedRoutes` on.
 *
 * `Link` accepts `href: RouteImpl<RouteType> | UrlObject` and *infers* `RouteType`
 * from the argument, which is what lets `/staff/vehicles/${id}` typecheck while a
 * string that is not a real route is rejected. Extracting the props with
 * `ComponentProps<typeof Link>` - the obvious way to build a wrapper - collapses
 * that: it instantiates the generic at `unknown`, so the inferred type is gone and
 * every `href` arrives as `RouteImpl<unknown>`. Against a *dynamic* route that
 * type is `never`, because `` string extends `/staff/vehicles/${string}` `` is
 * false, and the result is a wall of errors on legitimate links.
 *
 * So the generic is carried through instead, and the call site still gets the
 * checking. `LinkProps` is imported from `next/link` rather than rebuilt, which
 * means this wrapper cannot drift out of step with the component it wraps.
 */
export type ActionLinkProps<RouteInferType = string> = Omit<
  LinkProps<RouteInferType>,
  "className" | "children"
> &
  ActionLinkOwnProps;

/**
 * A link that looks like a button.
 *
 * A link is used rather than a `<button>` whenever the action navigates, which
 * keeps middle-click, "open in new tab" and keyboard behaviour correct. The styling
 * comes from the button recipes rather than being duplicated, so a variant can
 * never mean one thing on a button and another on a link.
 *
 * `tone` is the historical name for `variant`; both are accepted so existing
 * call sites keep working.
 */
export function ActionLink<RouteInferType = string>({
  variant,
  tone,
  size = "md",
  className,
  children,
  ...props
}: ActionLinkProps<RouteInferType>) {
  return (
    <Link
      {...(props as LinkProps<RouteInferType>)}
      className={buttonClasses(variant ?? tone ?? "primary", size, className)}
    >
      {children}
    </Link>
  );
}

/**
 * Classes for a link that has to look like a button but cannot be a
 * `next/link` - an external origin, for example the API reference on the
 * foundation page. Kept as a named export because call sites use it directly on a
 * plain `<a>`.
 */
export const actionClasses = buttonClasses;
