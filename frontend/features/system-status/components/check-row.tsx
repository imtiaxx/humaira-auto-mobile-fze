import { cn } from "@/lib/cn";

export type CheckState = "pass" | "fail" | "pending";

const STATE_LABEL: Record<CheckState, string> = {
  pass: "Pass",
  fail: "Fail",
  pending: "Checking",
};

const DOT: Record<CheckState, string> = {
  pass: "bg-success",
  fail: "bg-danger",
  pending: "bg-ink-300",
};

/**
 * One labelled verification result.
 *
 * Purely presentational: the caller decides the state. Keeping the mapping from
 * state to colour in one place is what stops status colours drifting between
 * pages.
 */
export function CheckRow({
  label,
  value,
  state,
  detail,
}: {
  label: string;
  value: string;
  state: CheckState;
  detail?: string;
}) {
  return (
    <li className="flex flex-col gap-1 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium text-fg">{label}</span>
        {detail ? <span className="text-xs text-fg-muted">{detail}</span> : null}
      </div>

      <div className="flex items-center gap-3 sm:justify-end">
        <span className="font-mono text-sm text-fg-secondary">{value}</span>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-xs px-2 py-0.5 text-xs font-medium tracking-wide uppercase",
            state === "pass" && "bg-success-surface text-success",
            state === "fail" && "bg-danger-surface text-danger",
            state === "pending" && "bg-neutral-surface text-neutral",
          )}
        >
          <span aria-hidden="true" className={cn("h-1.5 w-1.5 rounded-pill", DOT[state])} />
          {STATE_LABEL[state]}
        </span>
      </div>
    </li>
  );
}
