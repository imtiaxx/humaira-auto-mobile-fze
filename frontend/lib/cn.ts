/**
 * Conditional className joiner.
 *
 * Deliberately dependency-free. `clsx` plus `tailwind-merge` would be two extra
 * packages for behaviour this project does not need yet: components here accept
 * a `className` override and compose it with a fixed base string, and none of
 * them merge conflicting Tailwind utilities at runtime. Revisit only if a
 * component genuinely needs conflict resolution.
 */

export type ClassValue =
  | string
  | number
  | null
  | undefined
  | false
  | ClassValue[];

export function cn(...values: ClassValue[]): string {
  const out: string[] = [];

  for (const value of values) {
    if (!value && value !== 0) continue;
    if (Array.isArray(value)) {
      const nested = cn(...value);
      if (nested) out.push(nested);
    } else {
      out.push(String(value));
    }
  }

  return out.join(" ");
}
