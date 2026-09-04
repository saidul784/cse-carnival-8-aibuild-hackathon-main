/**
 * HTTP plumbing shared by every route handler.
 *
 * Route handlers stay thin: parse, delegate to a service, serialise. All error
 * translation lives here so that no route ever grows its own try/catch and no
 * two routes disagree about what a 409 looks like.
 *
 * Response envelope:
 *   success -> { ok: true,  data: ... }
 *   failure -> { ok: false, error: { code, message, details? } }
 */

import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AppError, isAppError } from "./errors";

/** Never cache: the dashboard and the agent must both see current state. */
export const NO_STORE = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
} as const;

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ ok: true, data }, { status, headers: NO_STORE });
}

export function created<T>(data: T) {
  return ok(data, 201);
}

function errorBody(code: string, message: string, details?: unknown) {
  return {
    ok: false as const,
    error: { code, message, ...(details === undefined ? {} : { details }) },
  };
}

/**
 * Translate anything thrown into a safe response.
 *
 * Unknown errors deliberately return a generic message: internal messages can
 * carry file paths or connection strings, and none of that belongs in a
 * response body. The detail is logged server-side instead.
 */
export function fail(e: unknown) {
  if (isAppError(e)) {
    return NextResponse.json(
      errorBody(e.code, e.message, e.details),
      { status: e.status, headers: NO_STORE },
    );
  }

  if (e instanceof ZodError) {
    return NextResponse.json(
      errorBody("VALIDATION_ERROR", "Request failed validation.", e.issues),
      { status: 400, headers: NO_STORE },
    );
  }

  console.error("[api] unhandled error:", e);
  return NextResponse.json(
    errorBody("INTERNAL_ERROR", "Something went wrong handling that request."),
    { status: 500, headers: NO_STORE },
  );
}

/** Wrap a handler body so every route shares the same failure path. */
export async function handle<T>(fn: () => Promise<T>) {
  try {
    return await fn();
  } catch (e) {
    return fail(e);
  }
}

/** Read a JSON body, turning malformed JSON into a 400 rather than a 500. */
export async function readJson(req: Request): Promise<unknown> {
  try {
    const text = await req.text();
    if (!text.trim()) return {};
    return JSON.parse(text);
  } catch {
    throw new AppError("VALIDATION_ERROR", "Request body is not valid JSON.");
  }
}
