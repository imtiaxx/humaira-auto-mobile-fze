import {
  ArrowRight,
  Car,
  Check,
  Gauge,
  Globe,
  Info,
  MapPin,
  Phone,
  Search,
  ShieldCheck,
  Truck,
  X,
} from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button-styles";
import {
  Card,
  CardBody,
  CardDescription,
  CardFooter,
  CardHeader,
  CardMedia,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Divider } from "@/components/ui/divider";
import { Field, FormMessage } from "@/components/ui/field";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { RadioGroup } from "@/components/ui/radio-group";
import { SearchInput } from "@/components/ui/search-input";
import { Select } from "@/components/ui/select";
import { Cluster, Stack } from "@/components/ui/stack";
import { EmptyState, ErrorState, LoadingState, Skeleton, SuccessState } from "@/components/ui/states";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  ShowcaseRow,
  ShowcaseSection,
  Specimen,
  TokenName,
} from "@/features/design-system/components/showcase-primitives";

/* -------------------------------------------------------------------------- */
/*  Typography                                                                  */
/* -------------------------------------------------------------------------- */

const TYPE_SCALE = [
  { token: "text-display", use: "Hero / page title", sample: "Vehicle Export" },
  { token: "text-h1", use: "Page title", sample: "Available Vehicles" },
  { token: "text-h2", use: "Section heading", sample: "Our Inventory" },
  { token: "text-h3", use: "Subsection", sample: "Performance" },
  { token: "text-h4", use: "Card title", sample: "Range Rover Sport" },
  { token: "text-body-lg", use: "Lead paragraph", sample: "Vehicles ready for export." },
  { token: "text-body", use: "Body copy", sample: "Inspect the specification." },
  { token: "text-body-sm", use: "Secondary / help", sample: "Added to the shortlist." },
  { token: "text-caption", use: "Metadata", sample: "Updated today" },
  { token: "text-label", use: "Eyebrow / column head", sample: "Category" },
] as const;

export function TypographySection() {
  return (
    <ShowcaseSection
      id="typography"
      title="Typography"
      description="Two families: Inter for text, Sora for headings. Both are variable, self-hosted, and cover weights 400-700. Each named token carries its own line height, tracking and weight, so one class is a complete typographic decision."
    >
      <div className="flex flex-col">
        {TYPE_SCALE.map((row) => (
          <ShowcaseRow key={row.token} label={row.token} hint={row.use}>
            <p
              className={
                row.token === "text-label"
                  ? "text-label text-fg-accent uppercase"
                  : row.token === "text-caption"
                    ? "text-caption text-fg-muted"
                    : row.token.startsWith("text-body")
                      ? row.token
                      : `${row.token} text-fg`
              }
            >
              {row.sample}
            </p>
          </ShowcaseRow>
        ))}
      </div>

      <ShowcaseRow label="Measure" hint="Long-form copy is capped at 68ch">
        <div className="container-prose flex flex-col gap-3 text-body text-fg-secondary">
          <p>
            A description of a vehicle, an export process or a policy runs to
            several sentences. Left uncapped it stretches to the full width of a
            monitor and the eye loses its place on the return line.
          </p>
          <p>
            The <code className="font-mono text-body-sm">container-prose</code>{" "}
            utility caps the measure instead of the font size, so the type scale
            stays consistent between a phone and a 27-inch display.
          </p>
        </div>
      </ShowcaseRow>

      <ShowcaseRow label="Numerals" hint="tabular-nums for aligned columns">
        <div className="flex flex-col gap-1 font-mono text-body-sm tnum text-fg-secondary">
          <span>1,850 cc</span>
          <span>250 km/h</span>
          <span>1,850 cc</span>
        </div>
      </ShowcaseRow>
    </ShowcaseSection>
  );
}

/* -------------------------------------------------------------------------- */
/*  Colour                                                                      */
/* -------------------------------------------------------------------------- */

const INK = ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900", "950"] as const;
const ACCENT = ["100", "200", "300", "400", "500", "600", "700", "800", "900"] as const;

function Swatch({ name, variable }: { name: string; variable: string }) {
  return (
    <div className="flex w-28 flex-col gap-1.5">
      <div
        className="h-12 rounded-sm border border-line"
        style={{ backgroundColor: `var(${variable})` }}
      />
      <TokenName>{name}</TokenName>
    </div>
  );
}

export function ColourSection() {
  return (
    <ShowcaseSection
      id="colour"
      title="Colour"
      description="A graphite neutral ramp carries the interface; a single brass accent marks the one most important action on a screen. Status colours are used only for state. Every pairing used by the component library is verified against WCAG AA by scripts/check-contrast.mjs."
    >
      <ShowcaseRow label="Semantic surfaces" hint="Use these, never the raw ramp">
        <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["bg-page", "Page"],
            ["bg-raised", "Raised"],
            ["bg-sunken", "Sunken"],
            ["bg-inverse text-fg-inverse", "Inverse"],
          ].map(([cls, label]) => (
            <div
              key={cls}
              className={`flex h-20 flex-col justify-end gap-1 rounded-card border border-line p-3 ${cls}`}
            >
              <span className="text-body-sm font-medium">{label}</span>
              <span className="font-mono text-caption opacity-70">{cls}</span>
            </div>
          ))}
        </div>
      </ShowcaseRow>

      <ShowcaseRow label="Text" hint="primary / secondary / muted / accent">
        <div className="flex w-full flex-col gap-2">
          <p className="text-body text-fg">text-fg &mdash; primary body text</p>
          <p className="text-body text-fg-secondary">text-fg-secondary &mdash; supporting copy</p>
          <p className="text-body text-fg-muted">text-fg-muted &mdash; metadata, hints</p>
          <p className="text-body text-fg-accent">text-fg-accent &mdash; emphasis, links</p>
        </div>
      </ShowcaseRow>

      <ShowcaseRow label="Ink ramp" hint="Surfaces, borders, neutral text">
        <div className="flex flex-wrap gap-2">
          {INK.map((step) => (
            <Swatch key={step} name={`ink-${step}`} variable={`--color-ink-${step}`} />
          ))}
        </div>
      </ShowcaseRow>

      <ShowcaseRow label="Brass accent" hint="One primary action per view. Never decoration.">
        <div className="flex flex-wrap gap-2">
          {ACCENT.map((step) => (
            <Swatch key={step} name={`accent-${step}`} variable={`--color-accent-${step}`} />
          ))}
        </div>
      </ShowcaseRow>

      <ShowcaseRow label="Status" hint="Available / reserved / sold / new / used / featured">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="success" dot>Available</Badge>
          <Badge tone="warning" dot>Reserved</Badge>
          <Badge tone="neutral" dot>Sold</Badge>
          <Badge tone="accent">New</Badge>
          <Badge tone="info">Used</Badge>
          <Badge tone="accent">Featured</Badge>
        </div>
        <p className="w-full text-body-sm text-fg-muted">
          The dot variant is the one to use on a listing tile: a tinted pill at
          thumbnail size can be mistaken for a filter chip, whereas a coloured dot
          reads as state at a glance and the text remains for anyone who cannot
          rely on colour.
        </p>
      </ShowcaseRow>
    </ShowcaseSection>
  );
}

/* -------------------------------------------------------------------------- */
/*  Buttons                                                                     */
/* -------------------------------------------------------------------------- */

export function ButtonsSection() {
  return (
    <ShowcaseSection
      id="buttons"
      title="Buttons"
      description="One shape, six variants, three sizes. Default is 44px tall so it is a valid touch target without a separate mobile variant. Icons are 16px, matching the 14px label optically."
    >
      <ShowcaseRow label="Variants" hint="accent is the one conversion action per view">
        <Specimen>
          <Button variant="primary">Primary</Button>
          <Button variant="accent">Accent</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
        </Specimen>
      </ShowcaseRow>

      <ShowcaseRow label="With icons" hint="Icons inherit size and alignment">
        <Specimen>
          <Button variant="primary">
            <Car aria-hidden="true" />
            View details
          </Button>
          <Button variant="accent">
            Request a quote
            <ArrowRight aria-hidden="true" />
          </Button>
          <Button variant="outline">
            <ShieldCheck aria-hidden="true" />
            Export options
          </Button>
        </Specimen>
      </ShowcaseRow>

      <ShowcaseRow label="Sizes" hint="sm is for dense, pointer-first surfaces">
        <Specimen>
          <Button size="sm" variant="outline">
            Small
          </Button>
          <Button size="md" variant="outline">
            Medium
          </Button>
          <Button size="lg" variant="outline">
            Large
          </Button>
        </Specimen>
      </ShowcaseRow>

      <ShowcaseRow label="States" hint="Focus a control with the keyboard to see the ring">
        <Specimen>
          <Button variant="primary">Default</Button>
          <Button variant="primary" disabled>
            Disabled
          </Button>
          <Button variant="accent" loading loadingText="Sending">
            Request a quote
          </Button>
          <Button variant="ghost" disabled>
            <X aria-hidden="true" />
            Unavailable
          </Button>
        </Specimen>
      </ShowcaseRow>

      <ShowcaseRow
        label="Icon button"
        hint="label is required, so it can never be unlabelled"
      >
        <Specimen>
          <IconButton icon={Search} label="Search" variant="outline" />
          <IconButton icon={Phone} label="Call" variant="outline" />
          <IconButton icon={MapPin} label="Location" variant="outline" />
        </Specimen>
      </ShowcaseRow>

      <ShowcaseRow label="As a link" hint="Navigation uses ActionLink, not Button">
        <Specimen>
          <a href="#buttons" className={buttonClasses("primary", "md")}>
            Primary link
          </a>
          <a href="#buttons" className={buttonClasses("accent", "md")}>
            Accent link
          </a>
        </Specimen>
      </ShowcaseRow>
    </ShowcaseSection>
  );
}

/* -------------------------------------------------------------------------- */
/*  Forms                                                                       */
/* -------------------------------------------------------------------------- */

export function FormsSection() {
  return (
    <ShowcaseSection
      id="forms"
      title="Form controls"
      description="Field owns the ids and the aria wiring, so a control inside it is always correctly associated with its label, help text and error. Labels are never replaced by placeholders."
    >
      <ShowcaseRow label="Text input" hint="default, disabled, invalid, read-only">
        <div className="grid w-full gap-4 sm:grid-cols-2">
          <Field label="Default">
            <Input placeholder="Placeholder text" />
          </Field>
          <Field label="Disabled" help="Not editable at this time.">
            <Input disabled value="Unavailable" readOnly />
          </Field>
          <Field label="Read only">
            <Input defaultValue="Dubai, United Arab Emirates" readOnly />
          </Field>
          <Field label="Invalid" error="Enter a valid email address.">
            <Input defaultValue="not-an-email" invalid />
          </Field>
        </div>
      </ShowcaseRow>

      <ShowcaseRow label="Required" hint="The asterisk is announced with the label">
        <div className="w-full sm:max-w-sm">
          <Field label="Email address" required help="We reply to enquiries in order.">
            <Input type="email" placeholder="name@example.com" />
          </Field>
        </div>
      </ShowcaseRow>

      <ShowcaseRow label="Search" hint="Clear button appears only when there is a value">
        <div className="w-full sm:max-w-sm">
          <Field label="Search" hideLabel>
            <SearchInput placeholder="Search by make or model" />
          </Field>
        </div>
      </ShowcaseRow>

      <ShowcaseRow label="Select" hint="Native control, so mobile gets the platform picker">
        <div className="grid w-full gap-4 sm:grid-cols-2">
          <Field label="Body type" help="Used to narrow the inventory list.">
            <Select defaultValue="" placeholder="Any body type">
              <option value="suv">SUV</option>
              <option value="sedan">Sedan</option>
              <option value="truck">Truck</option>
            </Select>
          </Field>
          <Field label="Transmission" error="Select a transmission to continue.">
            <Select defaultValue="">
              <option value="auto">Automatic</option>
              <option value="manual">Manual</option>
            </Select>
          </Field>
        </div>
      </ShowcaseRow>

      <ShowcaseRow label="Textarea" hint="Resizable, with a fixed minimum height">
        <div className="w-full sm:max-w-lg">
          <Field
            label="Enquiry"
            help="Include the vehicle reference if you have one."
            required
          >
            <Textarea placeholder="How can we help?" />
          </Field>
        </div>
      </ShowcaseRow>

      <ShowcaseRow label="Checkbox" hint="18px box, 44px hit target">
        <div className="w-full sm:max-w-md">
          <Stack gap="sm">
            <Checkbox label="Send me availability updates" />
            <Checkbox
              label="Include export options"
              description="Adds destination and shipping detail to the reply."
              defaultChecked
            />
            <Checkbox label="Unavailable while in transit" disabled />
          </Stack>
        </div>
      </ShowcaseRow>

      <ShowcaseRow label="Radio group" hint="A real fieldset, so the group is announced">
        <div className="w-full sm:max-w-md">
          <RadioGroup
            legend="Contact preference"
            name="showcase-contact"
            defaultValue="email"
            help="Applies to future enquiries only."
            options={[
              { value: "email", label: "Email" },
              { value: "phone", label: "Phone", description: "During business hours." },
              { value: "whatsapp", label: "Not available", disabled: true },
            ]}
          />
        </div>
      </ShowcaseRow>

      <ShowcaseRow label="Form messages" hint="info / success / warning / danger">
        <div className="flex w-full flex-col gap-3">
          <FormMessage tone="info">Reference numbers are issued on confirmation.</FormMessage>
          <FormMessage tone="success">Enquiry received.</FormMessage>
          <FormMessage tone="warning">Some fields are incomplete.</FormMessage>
          <FormMessage tone="danger">The enquiry could not be sent.</FormMessage>
        </div>
      </ShowcaseRow>

      <ShowcaseRow label="Without a Field" hint="A control can carry its own label">
        <div className="w-full sm:max-w-sm">
          <Input label="Standalone input" placeholder="No Field wrapper" />
        </div>
      </ShowcaseRow>
    </ShowcaseSection>
  );
}

/* -------------------------------------------------------------------------- */
/*  Surfaces                                                                    */
/* -------------------------------------------------------------------------- */

export function SurfacesSection() {
  return (
    <ShowcaseSection
      id="surfaces"
      title="Cards and surfaces"
      description="Cards are flat by default: a hairline border and no shadow. Elevation is reserved for things that genuinely float, because a page made entirely of shadowed boxes loses its hierarchy."
    >
      <ShowcaseRow label="Card" hint="Default is flat; interactive lifts on hover and focus">
        <div className="grid w-full gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <Badge tone="accent" size="sm">
                New
              </Badge>
              <CardTitle>Card title</CardTitle>
              <CardDescription>
                Supporting copy sits here at body-sm.
              </CardDescription>
            </CardHeader>
            <CardBody>
              <p className="text-body-sm text-fg-secondary">
                Card body content.
              </p>
            </CardBody>
            <CardFooter>
              <Button size="sm" variant="outline">
                View
              </Button>
            </CardFooter>
          </Card>

          <Card interactive>
            <CardMedia ratio="16 / 9" />
            <CardHeader>
              <CardTitle>Interactive card</CardTitle>
              <CardDescription>
                For a tile that is itself a link.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardMedia ratio="4 / 3" />
            <CardHeader>
              <CardTitle>Fixed media ratio</CardTitle>
              <CardDescription>
                Ratios keep a grid aligned whatever loads.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </ShowcaseRow>

      <ShowcaseRow label="Surface variants" hint="raised, sunken, inverse">
        <div className="grid w-full gap-4 sm:grid-cols-3">
          {(["raised", "sunken", "inverse"] as const).map((variant) => (
            <div
              key={variant}
              className={`rounded-card border p-5 ${
                variant === "raised"
                  ? "border-line bg-raised shadow-xs"
                  : variant === "sunken"
                    ? "border-line bg-sunken"
                    : "border-transparent bg-inverse text-fg-inverse"
              }`}
            >
              <p className="text-body font-medium capitalize">{variant}</p>
              <p className="text-body-sm opacity-70">Surface variant</p>
            </div>
          ))}
        </div>
      </ShowcaseRow>

      <ShowcaseRow label="Dividers" hint="Hairlines, not shadows">
        <div className="flex w-full flex-col gap-6">
          <Divider />
          <Divider label="Or" />
          <div className="flex h-8 items-center gap-3">
            <span className="text-body-sm text-fg-muted">Vertical</span>
            <Divider orientation="vertical" />
            <span className="text-body-sm text-fg-muted">separator</span>
            <Divider orientation="vertical" />
            <span className="text-body-sm text-fg-muted">inline</span>
          </div>
        </div>
      </ShowcaseRow>
    </ShowcaseSection>
  );
}

/* -------------------------------------------------------------------------- */
/*  Icons                                                                       */
/* -------------------------------------------------------------------------- */

export function IconsSection() {
  return (
    <ShowcaseSection
      id="icons"
      title="Icons"
      description="One library, one 24px grid, one 2px stroke. Every icon is re-exported from components/icons.ts, which is the only file permitted to import from the library, so mixing sets is detectable with a single grep."
    >
      <ShowcaseRow label="Sizing" hint="16px beside 14px text, 20px beside larger">
        <Specimen>
          {[Gauge, Globe, Car, Truck, ShieldCheck, Info, Check, X, Search, MapPin, Phone].map(
            (Icon) => (
              <Icon key={Icon.displayName ?? Icon.name} aria-hidden="true" className="size-4 text-fg-secondary" />
            ),
          )}
        </Specimen>
        <Specimen>
          {[Car, Truck, ShieldCheck, Gauge, Globe].map((Icon) => (
            <Icon key={Icon.displayName ?? Icon.name} aria-hidden="true" className="size-6 text-fg" />
          ))}
        </Specimen>
      </ShowcaseRow>

      <ShowcaseRow label="Alignment" hint="Icons sit on the text baseline in a button">
        <Specimen>
          <Button variant="primary" size="sm">
            <Gauge aria-hidden="true" />
            Icon with label
          </Button>
          <Button variant="ghost" size="sm">
            <Info aria-hidden="true" />
            Longer label to check centring
          </Button>
        </Specimen>
      </ShowcaseRow>

      <ShowcaseRow label="Accessibility" hint="Decorative icons are aria-hidden">
        <div className="flex w-full flex-col gap-3">
          <FormMessage tone="info">
            The icon inside this message is hidden from assistive technology; the
            text carries the meaning.
          </FormMessage>
          <p className="text-body-sm text-fg-muted">
            An icon is never the only label on an interactive control. IconButton
            requires an explicit <TokenName>label</TokenName> prop.
          </p>
        </div>
      </ShowcaseRow>
    </ShowcaseSection>
  );
}

/* -------------------------------------------------------------------------- */
/*  States                                                                      */
/* -------------------------------------------------------------------------- */

export function StatesSection() {
  return (
    <ShowcaseSection
      id="states"
      title="Empty, error and loading states"
      description="One shape for all three: icon, title, explanation, optional action. Using a single component means these occupy the same space and read consistently across the site."
    >
      <ShowcaseRow label="Empty" hint="role=status, announced politely">
        <div className="w-full">
          <EmptyState
            title="Nothing to show"
            description="This is how an empty result set will appear."
            action={{ label: "Clear filters" }}
          />
        </div>
      </ShowcaseRow>

      <ShowcaseRow label="Error" hint="role=alert, announced immediately">
        <div className="w-full">
          <ErrorState
            title="Could not load vehicles"
            description="This is how a failed request will appear."
            action={{ label: "Try again", variant: "primary" }}
          />
        </div>
      </ShowcaseRow>

      <ShowcaseRow label="Success" hint="role=status">
        <div className="w-full">
          <SuccessState title="Enquiry received" description="This is how a confirmation will appear." />
        </div>
      </ShowcaseRow>

      <ShowcaseRow label="Loading" hint="Skeleton highlight, not a pulse">
        <div className="grid w-full gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-3">
            <LoadingState label="Loading vehicles" rows={3} />
          </div>
          <div className="flex flex-col gap-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </div>
      </ShowcaseRow>
    </ShowcaseSection>
  );
}

/* -------------------------------------------------------------------------- */
/*  Layout                                                                      */
/* -------------------------------------------------------------------------- */

export function LayoutSection() {
  return (
    <ShowcaseSection
      id="layout"
      title="Spacing, container and responsive behaviour"
      description="A 4px base grid. Stack and Cluster own the gaps so no child carries a trailing margin, and container-page is the single source of page width."
    >
      <ShowcaseRow label="Stack" hint="Vertical rhythm, mobile-first">
        <div className="flex w-full flex-col gap-6">
          {(["sm", "md", "lg", "xl"] as const).map((gap) => (
            <div key={gap} className="flex flex-col gap-2">
              <span className="font-mono text-caption text-fg-muted">gap-{gap}</span>
              <Stack gap={gap}>
                <div className="h-6 w-full rounded-sm bg-sunken" />
                <div className="h-6 w-full rounded-sm bg-sunken" />
                <div className="h-6 w-2/3 rounded-sm bg-sunken" />
              </Stack>
            </div>
          ))}
        </div>
      </ShowcaseRow>

      <ShowcaseRow label="Cluster" hint="Wraps instead of scrolling horizontally">
        <Cluster gap="sm">
          {(["sm", "md", "lg"] as const).map((size) => (
            <Button key={size} size={size} variant="outline">
              Filter {size}
            </Button>
          ))}
          <Button size="md" variant="ghost">
            Clear all
          </Button>
        </Cluster>
      </ShowcaseRow>

      <ShowcaseRow label="Container" hint="Gutters grow at md and xl; width caps at 80rem">
        <div className="w-full rounded-card border border-dashed border-line-strong p-4 text-center">
          <p className="text-body-sm text-fg-secondary">
            This block spans the same container as the rest of the page. Resize
            the window to see the gutters grow at 768px and 1280px.
          </p>
        </div>
      </ShowcaseRow>

      <ShowcaseRow
        label="Breakpoints"
        hint="Mobile-first; this row is the scale, live"
      >
        <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {[
            ["base", "< 640px", "1 column"],
            ["sm", ">= 640px", "2 columns"],
            ["md", ">= 768px", "3 columns"],
            ["lg", ">= 1024px", "4 columns"],
          ].map(([name, width, layout]) => (
            <div key={name} className="rounded-card border border-line bg-raised p-4">
              <p className="text-body-sm font-medium text-fg">{name}</p>
              <p className="font-mono text-caption text-fg-muted">{width}</p>
              <p className="mt-2 text-body-sm text-fg-secondary">{layout}</p>
            </div>
          ))}
        </div>
        <p className="text-caption text-fg-muted">
          The grid above is one element with four states. Resize the window: it
          reflows 1 &rarr; 2 &rarr; 3 &rarr; 4 columns and never scrolls
          sideways. <span className="font-mono">xl</span> (1280px) and{" "}
          <span className="font-mono">2xl</span> (1536px) only widen the
          container, which caps at 80rem.
        </p>
      </ShowcaseRow>

      <ShowcaseRow label="Touch targets" hint="44px minimum for anything tappable">
        <Specimen>
          <Button size="md" variant="outline">
            44px default
          </Button>
          <IconButton icon={Search} label="Search" variant="outline" />
          <Checkbox label="Checkbox row" />
        </Specimen>
      </ShowcaseRow>
    </ShowcaseSection>
  );
}
