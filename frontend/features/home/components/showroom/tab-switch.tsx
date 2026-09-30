"use client";

/**
 * The New / Used segmented control.
 *
 * ---------------------------------------------------------------------------
 * Why this is one control and not two buttons
 * ---------------------------------------------------------------------------
 * The previous version rendered two independent `<button>`s that happened to sit
 * side by side. That reads as two actions - "New cars" and "Used cars" as separate
 * things to press - when the actual relationship is exclusive choice between two
 * views of the same list. Three things follow from modelling it properly:
 *
 *   1. It is a `tablist` with `role="tab"` children, so a screen reader announces
 *      "tab, 1 of 2, selected" rather than two loose buttons. That is the
 *      difference between a visitor knowing these are alternatives and not.
 *   2. It is one bordered container with a sliding fill, so the *grouping* is
 *      visible before either label is read.
 *   3. Only the active tab is in the tab order. Both buttons being focusable was
 *      the concrete accessibility cost of the old version: a keyboard user tabbed
 *      twice to reach the grid, for no gain.
 *
 * `aria-selected` is the real state. The red fill below is decoration on top of
 * it, so the control still works if the styles fail to load.
 *
 * Arrow-key navigation follows the WAI-ARIA tabs pattern: Left/Right move between
 * tabs and activate as they move, which is what makes the control feel like one
 * object rather than two.
 */

import { useRef } from "react";

import type { CarType } from "@/features/home/lib/showroom-cars";
import { cn } from "@/lib/cn";

const TABS: { type: CarType; label: string }[] = [
  { type: "new", label: "New cars" },
  { type: "used", label: "Used cars" },
];

export function TabSwitch({
  active,
  onChange,
  counts,
  labelledBy,
  tabIds,
  panelId,
}: {
  active: CarType;
  onChange: (type: CarType) => void;
  /** Rendered as a count on each tab. A tab with no cars shows `0`, not nothing. */
  counts: Record<CarType, number>;
  /** The id of the element naming this control, for `aria-labelledby`. */
  labelledBy: string;
  /**
   * Ids are owned by the parent rather than generated here.
   *
   * `useId` would work for the tabs, but the panel the tabs control lives in the
   * grid - a different component - and it has to reference the *same* id string
   * that `aria-controls` points at. A second `useId` in the grid would produce a
   * different value and the link would silently point at nothing. Passing both
   * ids down makes that desync impossible.
   */
  tabIds: Record<CarType, string>;
  panelId: string;
}) {
  // Needed for the arrow-key handler, which has to move focus as well as state.
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function focusTab(index: number) {
    const bounded = (index + TABS.length) % TABS.length;
    const next = TABS[bounded];
    onChange(next.type);
    refs.current[bounded]?.focus();
  }

  return (
    <div
      role="tablist"
      aria-labelledby={labelledBy}
      className={cn(
        // One bordered container: the grouping is the point, and two separately
        // bordered buttons was the other half of the "unrelated buttons" problem.
        "inline-flex items-center gap-1 rounded-pill border border-line-control bg-raised p-1",
      )}
      onKeyDown={(event) => {
        const index = TABS.findIndex((tab) => tab.type === active);
        if (event.key === "ArrowRight") {
          event.preventDefault();
          focusTab(index + 1);
        } else if (event.key === "ArrowLeft") {
          event.preventDefault();
          focusTab(index - 1);
        }
      }}
    >
      {TABS.map((tab, index) => {
        const selected = tab.type === active;

        return (
          <button
            key={tab.type}
            ref={(node) => {
              refs.current[index] = node;
            }}
            type="button"
            role="tab"
            id={tabIds[tab.type]}
            aria-selected={selected}
            aria-controls={panelId}
            // Only the selected tab is reachable by Tab. Roving tabindex is what
            // makes this one control in the tab order rather than two.
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.type)}
            className={cn(
              "rounded-pill px-5 py-2 text-[0.8125rem] font-semibold",
              "transition-[background-color,color,box-shadow] duration-200 ease-[var(--ease-standard)]",
              selected
                ? "bg-action-accent text-action-accent-content shadow-[0_6px_18px_-8px_rgb(224_16_35/0.7)]"
                : "text-fg-muted hover:text-fg",
            )}
          >
            {tab.label}
            {/*
              The count. It is inside the label rather than `aria-label`ed
              separately, so it is read as part of the tab name - "New cars, 4" -
              which is the information a visitor wants before pressing it.
            */}
            <span className="ml-2 tabular-nums opacity-70">{counts[tab.type]}</span>
          </button>
        );
      })}
    </div>
  );
}
