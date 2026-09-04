import { handle, ok, created, readJson } from "@/server/lib/http";
import {
  listRegistrations,
  registerForEvent,
} from "@/server/services/events.service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  return handle(async () => {
    const { id } = await params;
    return ok(await listRegistrations(id));
  });
}

/**
 * POST /api/events/:id/registrations
 *
 * Capacity and duplicate rules live in the service. A full event surfaces as
 * 409 EVENT_FULL, an existing registration as 409 DUPLICATE_REGISTRATION, and
 * a cancelled or completed event as 409 EVENT_CLOSED.
 */
export async function POST(req: Request, { params }: Ctx) {
  return handle(async () => {
    const { id } = await params;
    return created(await registerForEvent(id, await readJson(req)));
  });
}
