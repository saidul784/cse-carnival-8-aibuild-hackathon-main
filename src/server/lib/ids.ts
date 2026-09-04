/**
 * Identifier generation.
 *
 * schema/schema.md: "IDs are stable - use them as primary keys in your
 * backend." Seed IDs are preserved verbatim; new records continue the same
 * prefix-and-sequence convention so a record created through the dashboard is
 * indistinguishable in form from a seeded one.
 */

export const ID_PREFIX = {
  schedule: "sch",
  room: "room",
  event: "evt",
  announcement: "ann",
  assignment: "asgn",
  booking: "bk",
} as const;

export type IdKind = keyof typeof ID_PREFIX;

/**
 * Next id in a `prefix-NNN` sequence.
 *
 * Ids that do not match the convention are ignored when finding the maximum,
 * so a hand-written id can never wedge generation. The numeric part grows past
 * three digits rather than wrapping.
 */
export function nextSequentialId(
  kind: IdKind,
  existingIds: readonly string[],
  pad = 3,
): string {
  const prefix = ID_PREFIX[kind];
  const re = new RegExp(`^${prefix}-(\\d+)$`);

  let max = 0;
  for (const id of existingIds) {
    const m = re.exec(id);
    if (m) {
      const n = Number(m[1]);
      if (Number.isFinite(n) && n > max) max = n;
    }
  }

  const next = max + 1;
  return `${prefix}-${String(next).padStart(pad, "0")}`;
}

/** Guard against an explicitly supplied id colliding with an existing one. */
export function isTaken(id: string, existingIds: readonly string[]): boolean {
  return existingIds.includes(id);
}
