"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

import { Menu, X } from "@/components/icons";
import { ContactChannels } from "@/components/cta/contact-actions";
import { WhatsAppCta } from "@/components/cta/whatsapp-cta";
import { NavList } from "@/components/layout/nav-list";
import { buttonClasses } from "@/components/ui/button-styles";
import { Divider } from "@/components/ui/divider";
import { PRIMARY_NAV } from "@/navigation/config";
import { cn } from "@/lib/cn";

/**
 * Mobile navigation: a trigger button and a side drawer.
 *
 * ---------------------------------------------------------------------------
 * Built by hand, deliberately
 * ---------------------------------------------------------------------------
 * The obvious move is a headless component library for the dialog. This is
 * hand-built instead because a drawer is ~100 lines of `useEffect`, and adding a
 * dependency that ships its own React, its own state model and 15-30kB to
 * replace that is a poor trade for a site that will otherwise have very little
 * client JavaScript at all. The requirement that justified the library - a
 * genuinely hard focus trap - is the part implemented most carefully below.
 *
 * ---------------------------------------------------------------------------
 * What a modal drawer has to get right
 * ---------------------------------------------------------------------------
 * A drawer that shows a list of links but mishandles any one of these is worse
 * than no drawer, because every failure mode is invisible to a sighted mouse
 * user and hits keyboard and screen-reader users immediately:
 *
 *   1. Escape does nothing.            4. The page behind scrolls.
 *   2. Tab walks off into the page.    5. Focus is lost when it closes.
 *   3. No focus moves on open.         6. Clicking the scrim does nothing.
 *
 * All six are handled: Escape in the key handler, a wrap-around Tab trap, focus
 * moved to the close button on open and returned to the trigger on close, a body
 * scroll lock, and a scrim click handler.
 */

/**
 * Elements that can hold focus, for the Tab trap.
 *
 * `[tabindex]:not([tabindex="-1"])` is included deliberately - a container can be
 * programmatically focusable, and the trap has to be able to cycle back to it.
 * `disabled` is excluded because such an element is skipped by the browser and
 * focusing it is a no-op that silently breaks the cycle.
 */
const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export function MobileNav({ className }: { className?: string }) {
  const pathname = usePathname();

  /**
   * Which route the drawer was opened on, or `null` when it is closed.
   *
   * `open` is *derived* rather than stored, and that is the whole trick. The
   * obvious implementation is `const [open, setOpen] = useState(false)` plus an
   * effect that closes the drawer when `pathname` changes - but that is a
   * `setState` inside an effect, which schedules a second render pass on every
   * navigation and is exactly the cascading-render pattern React's own lint rule
   * warns about.
   *
   * Deriving it means navigation closes the drawer as a side effect of the
   * render that the navigation already caused. No effect, no extra pass, and it
   * covers every way the route can change - `onClick` on a link, browser
   * back/forward, or a programmatic `router.push` from anywhere else.
   */
  const [openedOn, setOpenedOn] = useState<string | null>(null);
  const open = openedOn === pathname;

  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const openDrawer = useCallback(() => setOpenedOn(pathname), [pathname]);
  const close = useCallback(() => setOpenedOn(null), []);

  /**
   * Everything that has to happen while the drawer is open: scroll lock, Escape,
   * the Tab trap, and moving focus in and back out again.
   *
   * All of it lives in one effect so the cleanup has a single, auditable list of
   * things to undo. A drawer that leaks one of these reproduces only on some
   * devices, which is why they are undone together.
   */
  useEffect(() => {
    if (!open) return;

    // --- 4. Stop the page behind scrolling. -------------------------------
    //
    // `overflow: hidden` on the body, plus a right padding equal to the width of
    // the scrollbar that just disappeared. Without the padding the entire page
    // shifts sideways by ~15px the moment the drawer opens - very visible on
    // desktop, and the most common complaint about hand-rolled scroll locks.
    const { body } = document;
    const previousOverflow = body.style.overflow;
    const previousPaddingRight = body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    body.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      body.style.paddingRight = `${scrollbarWidth}px`;
    }

    // --- 3. Move focus into the drawer. -----------------------------------
    //
    // The close button, not the panel. It is the first focusable element in DOM
    // order, so the Tab trap's wrap-around arithmetic starts from a known point,
    // and a keyboard user's first Tab lands inside the drawer rather than behind
    // it.
    closeRef.current?.focus();

    // Captured now rather than read in the cleanup: the ref will not have changed
    // by then, and reading it later is a stale-read hazard React's hooks lint
    // rightly flags.
    const trigger = triggerRef.current;

    // --- 1 and 2. Escape closes; Tab cycles. ------------------------------
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }

      if (event.key !== "Tab") return;

      const panel = panelRef.current;
      if (!panel) return;

      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        // An element that is `inert`, or inside a collapsed `<details>`, is in
        // the DOM but cannot take focus. Counting it would make the trap wrap
        // onto a dead end.
        (element) => element.offsetParent !== null || element === document.activeElement,
      );

      if (focusable.length === 0) {
        // Nothing to move to. Hold focus where it is rather than letting it
        // escape to the page behind.
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && (active === first || active === panel)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);

    // --- 5. Undo everything, and hand focus back. -------------------------
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      body.style.overflow = previousOverflow;
      body.style.paddingRight = previousPaddingRight;
      // Returning focus to the trigger is what stops a keyboard user being dumped
      // at the top of the document after closing the menu.
      trigger?.focus();
    };
  }, [open, close]);

  return (
    <div className={cn("lg:hidden", className)}>
      <button
        ref={triggerRef}
        type="button"
        onClick={open ? close : openDrawer}
        aria-expanded={open}
        aria-controls="mobile-nav-panel"
        aria-label={open ? "Close menu" : "Open menu"}
        className={buttonClasses("ghost", "md", "px-0")}
      >
        {/* Swapping the glyph rather than animating one keeps the motion budget
            spent on the drawer itself, where it actually matters. */}
        {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
      </button>

      {/*
        The drawer stays mounted and is toggled with `data-state`.

        Unmounting on close would make an exit animation impossible, and an exit
        animation is what stops the menu feeling like the page was yanked away.
        While closed the whole thing is `inert`, which removes it from the tab
        order and the accessibility tree - so it is neither a second copy of the
        navigation for a screen reader, nor a set of hidden focusable links
        sitting in the tab order.
      */}
      <div
        id="mobile-nav-panel"
        data-state={open ? "open" : "closed"}
        // React 19 treats `inert` as a boolean attribute, so `false` omits it
        // rather than emitting `inert="false"`.
        inert={!open}
        className={cn(
          "fixed inset-0 z-50 lg:hidden",
          // `invisible` is what actually removes it from the accessibility tree
          // and the tab order; `opacity` and the transform only carry the
          // transition.
          "invisible opacity-0 transition-[opacity,visibility] duration-[var(--duration-base)] ease-[var(--ease-standard)]",
          "data-[state=open]:visible data-[state=open]:opacity-100",
        )}
      >
        {/*
          Scrim. Clicking it closes the drawer (requirement 6), and it is what
          blocks pointer interaction with the page behind. `aria-hidden` because it
          is presentational - the Escape key and the close button are the
          accessible ways out, and a scrim is neither.

          `bg-scrim`, not `bg-inverse/60`. `--surface-inverse` is *light* on this
          canvas - it is what makes an inverted white plate work - so dimming with
          it washed the page out to white behind the panel rather than pushing it
          back. A scrim is its own role, so it has its own token.
        */}
        <button
          type="button"
          tabIndex={-1}
          aria-hidden="true"
          onClick={close}
          className="absolute inset-0 h-full w-full cursor-default bg-scrim"
        />

        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label="Site menu"
          className={cn(
            "absolute inset-y-0 right-0 flex w-[min(22rem,85vw)] flex-col",
            "bg-overlay shadow-lg",
            "translate-x-full transition-transform duration-[var(--duration-base)] ease-[var(--ease-out-soft)]",
            "data-[state=open]:translate-x-0",
            // Slides on a 180ms curve. Reduced motion collapses this to ~0 in the
            // global stylesheet, so honouring the preference needs no extra code.
          )}
        >
          <div className="flex h-16 shrink-0 items-center justify-between border-b border-line px-4">
            <span className="text-label text-fg-muted">Menu</span>
            <button
              ref={closeRef}
              type="button"
              onClick={close}
              aria-label="Close menu"
              className={buttonClasses("ghost", "md", "px-0")}
            >
              <X aria-hidden="true" />
            </button>
          </div>

          {/*
            The scroll region. `overscroll-contain` stops the drawer hitting the
            end of its list and starting to scroll the page behind it, which is a
            subtle and very annoying one on touch devices.
          */}
          <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto overscroll-contain px-4 py-5">
            <nav aria-label="Main">
              <NavList
                items={PRIMARY_NAV}
                variant="mobile"
                onNavigate={close}
                className="-mx-1"
              />
            </nav>

            <Divider />

            <div className="flex flex-col gap-5 pb-2">
              <WhatsAppCta
                label="Enquire on WhatsApp"
                ariaLabel="Enquire on WhatsApp"
                variant="accent"
                size="lg"
                className="w-full"
              />
              <ContactChannels />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
