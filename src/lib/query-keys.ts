/**
 * Query key registry.
 *
 * Centralised so a mutation can invalidate everything a change touches. Any
 * write invalidates `stats` too: the overview counts must move the moment a
 * record is added or removed, with no manual refresh.
 */

export const qk = {
  stats: ["stats"] as const,

  schedules: (filters?: unknown) =>
    filters === undefined
      ? (["schedules"] as const)
      : (["schedules", filters] as const),

  rooms: (filters?: unknown) =>
    filters === undefined ? (["rooms"] as const) : (["rooms", filters] as const),
  room: (id: string) => ["rooms", "detail", id] as const,
  roomAvailability: (params: unknown) => ["rooms", "available", params] as const,

  events: (filters?: unknown) =>
    filters === undefined ? (["events"] as const) : (["events", filters] as const),
  event: (id: string) => ["events", "detail", id] as const,

  announcements: (filters?: unknown) =>
    filters === undefined
      ? (["announcements"] as const)
      : (["announcements", filters] as const),

  assignments: (filters?: unknown) =>
    filters === undefined
      ? (["assignments"] as const)
      : (["assignments", filters] as const),
};

/** Root keys touched by a write, for blanket invalidation. */
export const ALL_ROOTS = [
  "stats",
  "schedules",
  "rooms",
  "events",
  "announcements",
  "assignments",
] as const;
