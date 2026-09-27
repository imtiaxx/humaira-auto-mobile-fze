import { Container } from "@/components/ui/container";
import { Surface } from "@/components/ui/surface";

/**
 * Route-level loading UI. Reserves the final layout so the page does not shift
 * when the data resolves, and announces the wait to assistive technology.
 */
export default function Loading() {
  return (
    <Container className="flex flex-col gap-10 py-14 md:py-20">
      <p role="status" aria-live="polite" className="text-sm text-fg-muted">
        Checking service health&hellip;
      </p>

      <Surface className="overflow-hidden" aria-hidden="true">
        <ul className="divide-y divide-line">
          {[0, 1, 2, 3].map((row) => (
            <li key={row} className="flex items-center justify-between gap-6 px-5 py-4">
              <span className="h-3 w-40 animate-pulse rounded-xs bg-sunken" />
              <span className="h-3 w-24 animate-pulse rounded-xs bg-sunken" />
            </li>
          ))}
        </ul>
      </Surface>
    </Container>
  );
}
