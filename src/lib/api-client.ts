/**
 * Typed fetch wrapper for the CampusOS API.
 *
 * The UI talks to the backend exclusively through this module. Nothing in
 * src/components or src/app imports from data/ — the seed files are not the
 * runtime database.
 */

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

type Envelope<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string; details?: unknown } };

/** `body` is a plain value here and is JSON-encoded below, so it is kept out
 *  of the RequestInit type it would otherwise conflict with. */
type RequestOptions = Omit<RequestInit, "body"> & { body?: unknown };

async function request<T>(path: string, init?: RequestOptions): Promise<T> {
  const { body, ...rest } = init ?? {};

  const res = await fetch(`/api${path}`, {
    ...rest,
    // Never serve a cached response: a judge editing a record must see it on
    // the very next read.
    cache: "no-store",
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...rest.headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

  let json: Envelope<T> | null = null;
  try {
    json = (await res.json()) as Envelope<T>;
  } catch {
    throw new ApiError(res.status, "INVALID_RESPONSE", "The server returned an unreadable response.");
  }

  if (!res.ok || !json || json.ok === false) {
    const err = json && json.ok === false ? json.error : null;
    throw new ApiError(
      res.status,
      err?.code ?? "UNKNOWN",
      err?.message ?? "Request failed.",
      err?.details,
    );
  }

  return json.data;
}

/** Build a query string, dropping empty values. */
export function qs(params: Record<string, unknown> = {}): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    if (Array.isArray(v)) {
      if (v.length) sp.set(k, v.join(","));
      continue;
    }
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "POST", body }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PATCH", body }),
  del: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
