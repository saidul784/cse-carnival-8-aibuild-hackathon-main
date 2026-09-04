import { handle, ok, created, readJson } from "@/server/lib/http";
import { RoomQuerySchema, equipmentParam, parseQuery } from "@/lib/validators";
import { createRoom, listRooms } from "@/server/services/rooms.service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request) {
  return handle(async () => {
    const filters = parseQuery(RoomQuerySchema, req.url);
    const equipment = equipmentParam(req.url);
    return ok(await listRooms({ ...filters, ...(equipment ? { equipment } : {}) }));
  });
}

export async function POST(req: Request) {
  return handle(async () => created(await createRoom(await readJson(req))));
}
