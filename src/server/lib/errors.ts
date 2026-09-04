/**
 * Predictable, typed application errors.
 *
 * Every service throws one of these instead of a bare Error, so API routes
 * (Phase 5) and agent tools (Phase 7) can map a failure to an HTTP status and
 * a machine-readable code without inspecting message strings.
 */

export type ErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "CONFLICT"
  | "BOOKING_CONFLICT"
  | "ROOM_UNAVAILABLE"
  | "EVENT_FULL"
  | "EVENT_CLOSED"
  | "DUPLICATE_REGISTRATION"
  | "REGISTRATION_NOT_FOUND"
  | "INVALID_TIME_RANGE";

const STATUS: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  INVALID_TIME_RANGE: 400,
  NOT_FOUND: 404,
  REGISTRATION_NOT_FOUND: 404,
  CONFLICT: 409,
  BOOKING_CONFLICT: 409,
  ROOM_UNAVAILABLE: 409,
  EVENT_FULL: 409,
  EVENT_CLOSED: 409,
  DUPLICATE_REGISTRATION: 409,
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = STATUS[code];
    this.details = details;
  }

  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details === undefined ? {} : { details: this.details }),
      },
    };
  }
}

export const notFound = (what: string, id: string) =>
  new AppError("NOT_FOUND", `${what} "${id}" was not found.`);

export const invalid = (message: string, details?: unknown) =>
  new AppError("VALIDATION_ERROR", message, details);

export function isAppError(e: unknown): e is AppError {
  return e instanceof AppError;
}

/** Normalise anything thrown into an AppError. */
export function toAppError(e: unknown): AppError {
  if (isAppError(e)) return e;
  if (e instanceof Error) return new AppError("CONFLICT", e.message);
  return new AppError("CONFLICT", "Unexpected error.");
}
