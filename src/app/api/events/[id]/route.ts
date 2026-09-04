import { handle, ok, readJson } from "@/server/lib/http";
import {
  deleteEvent,
  getEvent,
  updateEvent,
} from "@/server/services/events.service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  return handle(async () => {
    const { id } = await params;
    return ok(await getEvent(id));
  });
}

export async function PATCH(req: Request, { params }: Ctx) {
  return handle(async () => {
    const { id } = await params;
    return ok(await updateEvent(id, await readJson(req)));
  });
}

export { PATCH as PUT };

export async function DELETE(_req: Request, { params }: Ctx) {
  return handle(async () => {
    const { id } = await params;
    return ok(await deleteEvent(id));
  });
}
