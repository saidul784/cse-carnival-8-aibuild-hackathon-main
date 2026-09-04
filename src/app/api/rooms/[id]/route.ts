import { handle, ok, readJson } from "@/server/lib/http";
import {
  checkAvailability,
  deleteRoom,
  resolveRoom,
  updateRoom,
} from "@/server/services/rooms.service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/rooms/:id
 *
 * `id` accepts a room id ("room-002") or a room number ("7A02"), because the
 * agent and the dashboard naturally hold different handles on the same room.
 * Passing date+start_time+end_time additionally reports availability.
 */
export async function GET(req: Request, { params }: Ctx) {
  return handle(async () => {
    const { id } = await params;
    const url = new URL(req.url);
    const date = url.searchParams.get("date");
    const start_time = url.searchParams.get("start_time");
    const end_time = url.searchParams.get("end_time");

    const room = await resolveRoom(id);

    if (date && start_time && end_time) {
      return ok({
        room,
        availability: await checkAvailability(room.room_number, {
          date,
          start_time,
          end_time,
        }),
      });
    }
    return ok(room);
  });
}

export async function PATCH(req: Request, { params }: Ctx) {
  return handle(async () => {
    const { id } = await params;
    const room = await resolveRoom(id);
    return ok(await updateRoom(room.id, await readJson(req)));
  });
}

export { PATCH as PUT };

export async function DELETE(_req: Request, { params }: Ctx) {
  return handle(async () => {
    const { id } = await params;
    const room = await resolveRoom(id);
    return ok(await deleteRoom(room.id));
  });
}
