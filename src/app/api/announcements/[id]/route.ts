import { handle, ok, readJson } from "@/server/lib/http";
import {
  deleteAnnouncement,
  getAnnouncement,
  updateAnnouncement,
} from "@/server/services/announcements.service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  return handle(async () => {
    const { id } = await params;
    return ok(await getAnnouncement(id));
  });
}

export async function PATCH(req: Request, { params }: Ctx) {
  return handle(async () => {
    const { id } = await params;
    return ok(await updateAnnouncement(id, await readJson(req)));
  });
}

export { PATCH as PUT };

export async function DELETE(_req: Request, { params }: Ctx) {
  return handle(async () => {
    const { id } = await params;
    return ok(await deleteAnnouncement(id));
  });
}
