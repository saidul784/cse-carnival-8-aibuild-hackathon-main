import { handle, ok, readJson } from "@/server/lib/http";
import {
  deleteSchedule,
  getSchedule,
  updateSchedule,
} from "@/server/services/schedules.service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  return handle(async () => {
    const { id } = await params;
    return ok(await getSchedule(id));
  });
}

export async function PATCH(req: Request, { params }: Ctx) {
  return handle(async () => {
    const { id } = await params;
    return ok(await updateSchedule(id, await readJson(req)));
  });
}

export { PATCH as PUT };

export async function DELETE(_req: Request, { params }: Ctx) {
  return handle(async () => {
    const { id } = await params;
    return ok(await deleteSchedule(id));
  });
}
