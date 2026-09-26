"use client";

import type { ComponentProps, ReactNode } from "react";

import { LoaderCircle } from "@/components/icons";
import {
  buttonClasses,
  type ButtonSize,
  type ButtonVariant,
} from "@/components/ui/button-styles";
import { cn } from "@/lib/cn";

export { buttonClasses, type ButtonSize, type ButtonVariant };

/**
 * A spinner sized to sit on the button's own text baseline.
 *
 * `aria-hidden` because the button's accessible name already says what is
 * happening; announcing "loading" on top of it is noise for a screen reader
 * user. The state is exposed properly via `aria-busy` on the button instead.
 */
function Spinner() {
  return <LoaderCircle aria-hidden="true" className="animate-spin-slow" />;
}

type NativeButtonProps = Omit<ComponentProps<"button">, "className" | "children">;

export type ButtonProps = NativeButtonProps & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Swap the leading icon for a spinner and block interaction. */
  loading?: boolean;
  /** Keep the label width stable while loading, to avoid a layout jump. */
  loadingText?: string;
  className?: string;
  children: ReactNode;
};

/**
 * The button.
 *
 * A `<button>` only. Anything that navigates must be an `ActionLink`, because a
 * link and a button have different keyboard and middle-click behaviour and using
 * the wrong one is a real accessibility bug rather than a style choice.
 */
export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  loadingText,
  className,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type="button"
      className={buttonClasses(variant, size, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Spinner /> : null}
      {/* Both labels are rendered and one is hidden, so the button does not
          change width between states when `loadingText` is supplied. */}
      <span className={cn("inline-flex items-center gap-2", loading && loadingText && "hidden")}>
        {children}
      </span>
      {loading && loadingText ? <span>{loadingText}</span> : null}
    </button>
  );
}
