import { Mail, MessageCircle, Phone } from "@/components/icons";
import { type ButtonSize } from "@/components/ui/button-styles";
import { WhatsAppCta } from "@/components/cta/whatsapp-cta";
import { CONTACT } from "@/config/site";
import { env } from "@/lib/env";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { cn } from "@/lib/cn";

/**
 * Contact channels, assembled from verified values only.
 *
 * The business's phone and email are not confirmed yet, so today this renders
 * the showroom address and nothing else. That is the intended output, not a gap:
 * the address is the one confirmed channel, and the rest appear the moment their
 * config values are filled in - no change to any component.
 *
 * Each channel resolves through a small guard that returns nothing when its value
 * is absent. The alternative - rendering disabled placeholders for phone and
 * email - tells a visitor those channels exist but are broken, which is worse
 * than not mentioning them.
 *
 * No state and no event handlers, so this is a Server Component and ships no
 * JavaScript.
 */

type ChannelId = "whatsapp" | "phone" | "email";

type Channel = {
  id: ChannelId;
  label: string;
  /** Human-readable value shown beside the label. */
  value: string;
  /** Present only for channels that can actually be activated. */
  href?: string;
  icon: typeof Phone;
};

/**
 * Resolves the channels that are genuinely configured.
 *
 * Exported so the mobile drawer and the footer present exactly the same set
 * without either duplicating these rules.
 */
export function resolveContactChannels(): Channel[] {
  const channels: Channel[] = [];

  const whatsappHref = buildWhatsAppUrl(env.whatsappNumber);
  if (whatsappHref !== null) {
    channels.push({
      id: "whatsapp",
      label: "WhatsApp",
      value: "Message us on WhatsApp",
      href: whatsappHref,
      icon: MessageCircle,
    });
  }

  if (CONTACT.phone) {
    // `tel:` gets digits and a leading `+` only, so spaces and punctuation in a
    // display-formatted number cannot produce a malformed URI.
    const tel = CONTACT.phone.replace(/[^\d+]/g, "");
    channels.push({
      id: "phone",
      label: "Phone",
      value: CONTACT.phone,
      href: `tel:${tel}`,
      icon: Phone,
    });
  }

  if (CONTACT.email) {
    channels.push({
      id: "email",
      label: "Email",
      value: CONTACT.email,
      href: `mailto:${CONTACT.email}`,
      icon: Mail,
    });
  }

  return channels;
}

/** The contact channel list. Renders `null` when nothing is configured. */
export function ContactChannels({
  className,
  showIcons = true,
}: {
  className?: string;
  showIcons?: boolean;
}) {
  const channels = resolveContactChannels();

  if (channels.length === 0) return null;

  return (
    <ul className={cn("flex flex-col gap-3", className)}>
      {channels.map((channel) => {
        const Icon = channel.icon;
        const body = (
          <>
            {showIcons ? (
              <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            ) : null}
            <span className="flex min-w-0 flex-col">
              <span className="text-label text-fg-muted">{channel.label}</span>
              <span className="text-body-sm break-words text-fg-secondary">
                {channel.value}
              </span>
            </span>
          </>
        );

        return (
          <li key={channel.id} className="flex gap-3">
            {channel.href ? (
              <a
                href={channel.href}
                // Only WhatsApp leaves the site. `tel:` and `mailto:` hand off to
                // an OS handler and must not open a blank tab.
                {...(channel.id === "whatsapp"
                  ? { target: "_blank", rel: "noopener noreferrer" }
                  : {})}
                className="flex min-w-0 items-start rounded-xs transition-colors duration-[var(--duration-fast)] hover:text-fg"
              >
                {body}
              </a>
            ) : (
              <span className="flex min-w-0 items-start">{body}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** A titled contact block, for the footer and for a future contact page. */
export function ContactBlock({
  headingLevel = "h2",
  id = "contact-heading",
  className,
}: {
  headingLevel?: "h2" | "h3";
  id?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {headingLevel === "h3" ? (
        <h3 id={id} className="text-label text-fg-muted">
          Contact
        </h3>
      ) : (
        <h2 id={id} className="text-label text-fg-muted">
          Contact
        </h2>
      )}
      <ContactChannels />
    </div>
  );
}

/**
 * The header's single prominent contact action.
 *
 * Currently the WhatsApp CTA, which is itself suppressed until a number is
 * configured - so the header currently renders no primary action at all. That is
 * correct: a permanently visible but non-functional "Contact" button in the
 * header of a site with no contact route is the worst of the available options.
 *
 * When `/contact` is built, promote it to an `ActionLink` here and this becomes
 * the one line that changes.
 */
export function HeaderContactAction({
  size = "sm",
  className,
}: {
  size?: ButtonSize;
  className?: string;
}) {
  return (
    <WhatsAppCta
      label="Enquire"
      ariaLabel="Enquire on WhatsApp"
      variant="accent"
      size={size}
      className={className}
    />
  );
}
