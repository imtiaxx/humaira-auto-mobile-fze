/**
 * The one place this project is allowed to import an icon library from.
 *
 * Why this file exists: the design system standard is a single icon set with a
 * consistent visual weight. Mixing libraries is the fastest way to lose that -
 * two sets of stroke weights and two optical sizes in the same toolbar reads as
 * a mistake even when nobody can say why. Routing every icon through one module
 * makes the rule enforceable rather than aspirational: `grep -r "lucide-react"
 * --exclude=icons.ts` returns nothing.
 *
 * Why Lucide: a single 24x24 grid, a uniform 2px stroke, and icons drawn on the
 * same optical size as the type they sit next to. It is tree-shakeable, so
 * importing one icon does not ship the set.
 *
 * Adding an icon: pick the closest existing name from the set first, and only
 * add a new one here if nothing fits. Icons are functional, not decorative -
 * if an icon is not carrying meaning that a word could not, leave it out.
 */

export type { LucideIcon, LucideProps } from "lucide-react";

export {
  // Directional
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  // Actions
  Check,
  Copy,
  ExternalLink,
  Menu,
  Minus,
  Plus,
  Search,
  Upload,
  X,
  // Status and feedback
  CircleAlert,
  CircleCheck,
  Info,
  LoaderCircle,
  TriangleAlert,
  // Destructive
  Trash,
  // Content
  Car,
  FileText,
  Gauge,
  Globe,
  LayoutGrid,
  List,
  Mail,
  MapPin,
  Phone,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Star,
  Truck,
  Wrench,
} from "lucide-react";
