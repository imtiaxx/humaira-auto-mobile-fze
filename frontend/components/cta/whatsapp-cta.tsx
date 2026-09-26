import { MessageCircle } from "@/components/icons";
import { buttonClasses, type ButtonSize, type ButtonVariant } from "@/components/ui/button-styles";
import { env } from "@/lib/env";
import {
  buildWhatsAppUrl,
  DEFAULT_WHATSAPP_MESSAGE,
} from "@/lib/whatsapp";
import { cn } from "@/lib/cn";

/**
 * WhatsApp call to action.
 *
 * A Server Component with no state and no event handlers: it is a link, so it
 * needs no client JavaScript at all.
 *
 * ---------------------------------------------------------------------------
 * Behaviour when the number is not configured
 * ---------------------------------------------------------------------------
 * The official number is not confirmed yet, so in every environment right now
 * `env.whatsappNumber` is `undefined` and this component renders **nothing**.
 *
 * That is deliberate. The alternatives are all worse: linking to a guessed
 * number routes a customer's enquiry to a stranger; rendering a dead-looking
 * disabled button puts a broken affordance in the header of every page; and
 * rendering a fake placeholder number is the exact failure this project is
 * built to avoid.
 *
 * Absent means absent. Set `NEXT_PUBLIC_WHATSAPP_NUMBER` to a confirmed number
 * and this appears in the header, the mobile drawer and the floating action
 * without a code change.
 *
 * ---------------------------------------------------------------------------
 * Why a plain `<a>` and not `next/link`
 * ---------------------------------------------------------------------------
 * `wa.me` is a different origin. `next/link` would try to client-side navigate to
 * it, which cannot work, so it falls back to a full page load anyway - after
 * paying for the router machinery. The step-2 convention is that a link to
 * another origin is a plain anchor styled with the button recipes, and that is
 * what this does.
 */

/**
 * The icon is `MessageCircle`, not a WhatsApp glyph.
 *
 * Lucide deliberately ships no brand marks - they are trademarks, and the set
 * keeps itself out of that territory. That is the right call for a component
 * library, and the reason the brand treatment in the header is type rather than
 * a logo. A generic chat bubble communicates the action ("message us") without
 * impersonating a trademark, and the visible label always carries the meaning,
 * so the icon is decorative and hidden from assistive technology.
 */
function WhatsAppIcon() {
  return <MessageCircle aria-hidden="true" />;
}

export type WhatsAppCtaProps = {
  /**
   * Pre-filled message. Pages pass context here - a vehicle reference on a
   * detail page, a country on an export page - so the message is pre-filled with
   * the conversation already started.
   *
   * Encoded by `buildWhatsAppUrl`; pass it raw.
   */
  message?: string;
  /** Visible label. Keep it short enough to fit a header. */
  label?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  /**
   * Accessible name, when the visible label is not descriptive on its own.
   * Defaults to the label.
   */
  ariaLabel?: string;
  /**
   * What to do when no valid number is configured.
   *
   * - `"hidden"` (default) renders nothing. Correct for the header, the drawer
   *   and the floating button.
   * - `"disabled"` renders a visibly unavailable control. Only useful on a page
   *   that is *about* contacting the business, where the absence of a button
   *   would otherwise look like an oversight. It gets `aria-disabled` and no
   *   `href`, so it is announced as unavailable and cannot be activated.
   */
  unavailable?: "hidden" | "disabled";
  className?: string;
};

export function WhatsAppCta({
  message = DEFAULT_WHATSAPP_MESSAGE,
  label = "WhatsApp",
  variant = "outline",
  size = "md",
  ariaLabel,
  unavailable = "hidden",
  className,
}: WhatsAppCtaProps) {
  const href = buildWhatsAppUrl(env.whatsappNumber, message);

  if (href === null) {
    if (unavailable === "hidden") return null;

    return (
      <span
        // `aria-disabled` rather than `disabled`: this is not a form control, it
        // is a button-shaped placeholder. Announcing it as disabled tells a
        // screen-reader user why it will not respond, which is the whole point.
        aria-disabled="true"
        title="WhatsApp enquiries are not available yet"
        className={cn(
          buttonClasses(variant, size, className),
          "cursor-not-allowed opacity-50",
        )}
      >
        <WhatsAppIcon />
        {label}
      </span>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      // `noopener` prevents the opened tab from reaching back through
      // `window.opener`; `noreferrer` also withholds the referrer.
      rel="noopener noreferrer"
      aria-label={ariaLabel ?? label}
      className={buttonClasses(variant, size, className)}
    >
      <WhatsAppIcon />
      {label}
    </a>
  );
}

/**
 * Floating WhatsApp action.
 *
 * The persistent, always-reachable contact affordance on mobile, where a phone
 * number is the primary conversion route. Hidden on large screens, where the
 * header and footer already carry the contact action and a floating button
 * would just sit on top of the content.
 *
 * Returns `null` when unconfigured, so it costs nothing on the site today.
 *
 * Sizing and placement notes:
 * - `size="lg"` is 48px, above the 44px minimum, because this is a thumb target
 *   floating over content rather than an inline control.
 * - `bottom-4 right-4` keeps it clear of the iOS home indicator and of a right
 *   side-drawer, which opens from the same edge.
 * - `z-40` sits below the mobile drawer (`z-50`) so the drawer's scrim covers
 *   it rather than leaving a live button floating over a locked page.
 */
export function WhatsAppFloat({ message }: { message?: string }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-end p-4 sm:hidden">
      <div className="pointer-events-auto">
        <WhatsAppCta
          message={message}
          label="WhatsApp"
          ariaLabel="Enquire on WhatsApp"
          variant="accent"
          size="lg"
        />
      </div>
    </div>
  );
}
