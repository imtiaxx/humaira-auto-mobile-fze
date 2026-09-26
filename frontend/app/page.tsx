import type { Metadata } from "next";

import { ActionLink, actionClasses } from "@/components/ui/action-link";
import { Badge } from "@/components/ui/badge";
import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";
import { Surface } from "@/components/ui/surface";
import { env } from "@/lib/env";

export const metadata: Metadata = {
  title: "Foundation",
  description: "Technical foundation status for the Humera Automobile platform.",
};

/**
 * Items that are genuinely working at this commit. Each one is verified by the
 * checks in the README; none of them are aspirational.
 */
const IMPLEMENTED = [
  "Next.js App Router with TypeScript strict mode and typed routes",
  "Tailwind CSS v4 design tokens: colour, type, spacing, radius, elevation",
  "Typed API client with timeout, correlation IDs and normalised errors",
  "FastAPI service with versioned routing, structured errors and logging",
  "PostgreSQL schema managed by Alembic migrations",
  "Argon2id password hashing and session/token primitives",
] as const;

/**
 * Deliberately absent. Listed so nobody mistakes a missing feature for an
 * oversight, and so the next step has an explicit starting point.
 */
const NOT_YET = [
  "Vehicle inventory, search and filtering",
  "Individual vehicle pages and comparison",
  "Enquiry forms, WhatsApp and phone hand-off",
  "Export requests and quotations",
  "Customer accounts and authentication screens",
  "Admin dashboard and CRM",
] as const;

export default function HomePage() {
  return (
    <Container className="flex flex-col gap-14 py-16 md:py-24">
        <section className="flex max-w-3xl flex-col gap-5">
          <Badge tone="accent">Step 1 &middot; Foundation</Badge>
          <h1 className="text-4xl font-semibold text-fg">
            Humera Automobile platform
          </h1>
          <p className="text-lg text-fg-secondary">
            The technical foundation is in place. The public website, vehicle inventory
            and enquiry workflows are built in later steps &mdash; this page is a
            technical placeholder, not the finished site.
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <ActionLink href="/system-status" tone="accent">
              Check system status
            </ActionLink>
            {/* External origin: a plain anchor, not `next/link`. */}
            <a
              href={`${env.apiUrl}/docs`}
              className={actionClasses("outline")}
              rel="noreferrer noopener"
            >
              API reference
            </a>
          </div>
        </section>

        <section className="grid gap-6 md:grid-cols-2">
          <Surface className="flex flex-col gap-4 p-6">
            <SectionHeading eyebrow="Working now" title="Implemented" />
            <ul className="flex flex-col gap-2.5">
              {IMPLEMENTED.map((item) => (
                <li key={item} className="flex gap-3 text-sm text-fg-secondary">
                  <span aria-hidden="true" className="mt-2 h-1 w-1 shrink-0 rounded-pill bg-accent-500" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </Surface>

          <Surface className="flex flex-col gap-4 p-6">
            <SectionHeading eyebrow="Planned" title="Not yet built" />
            <ul className="flex flex-col gap-2.5">
              {NOT_YET.map((item) => (
                <li key={item} className="flex gap-3 text-sm text-fg-secondary">
                  <span aria-hidden="true" className="mt-2 h-1 w-1 shrink-0 rounded-pill bg-ink-300" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </Surface>
        </section>
      </Container>
  );
}
