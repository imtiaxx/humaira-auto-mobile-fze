"use client";

import { useState, type ReactNode } from "react";

import { Search, X } from "@/components/icons";
import { cn } from "@/lib/cn";
import { Input, type InputProps } from "@/components/ui/input";

type Props = Omit<InputProps, "type" | "value" | "defaultValue" | "onChange"> & {
  /** Controlled value. Omit together with `defaultValue` for an uncontrolled field. */
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** Rendered in place of the magnifier. Must be decorative and non-interactive. */
  leading?: ReactNode;
  /** Called after the field is cleared, in addition to `onValueChange("")`. */
  onClear?: () => void;
};

/**
 * Search input with a clear button.
 *
 * The magnifier is `aria-hidden` - the field's own `type="search"` and its label
 * already convey the purpose, and announcing an icon name adds nothing.
 *
 * The clear button only renders when there is something to clear, so the field
 * does not change width as the user types. It is a real `<button type="button">`
 * inside the field rather than a `div`, so it is reachable by keyboard.
 *
 * State is held locally and mirrored through `onValueChange`, which keeps the
 * component usable uncontrolled (a plain search form) while still allowing a
 * caller to drive it - which is what a results page will need.
 */
export function SearchInput({
  value,
  defaultValue,
  onValueChange,
  onClear,
  leading,
  className,
  ...props
}: Props) {
  const [internal, setInternal] = useState(defaultValue ?? "");
  const isControlled = value !== undefined;
  const current = isControlled ? value : internal;

  const setValue = (next: string) => {
    if (!isControlled) setInternal(next);
    onValueChange?.(next);
  };

  const clear = () => {
    setValue("");
    onClear?.();
  };

  return (
    <div className="relative w-full min-w-0">
      {leading ?? (
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-muted"
        />
      )}

      <Input
        type="search"
        value={current}
        onChange={(event) => setValue(event.target.value)}
        // The platform clear affordance is removed so it does not appear
        // alongside ours, which would give the field two clear buttons.
        className={cn(
          "pr-10 pl-9",
          // Tailwind's `search-cancel` pseudo-element hides WebKit's native
          // clear button.
          "[&::-webkit-search-cancel-button]:appearance-none",
          className,
        )}
        {...props}
      />

      {current ? (
        <button
          type="button"
          onClick={clear}
          aria-label="Clear search"
          className={cn(
            "absolute top-1/2 right-1 flex size-9 -translate-y-1/2 items-center justify-center",
            "rounded-xs text-fg-muted transition-colors duration-[var(--duration-fast)]",
            "hover:bg-sunken hover:text-fg",
          )}
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      ) : null}
    </div>
  );
}
