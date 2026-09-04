/**
 * Free rooms in a window.
 *
 * Sits above /api/rooms/[id] in Next's routing: static segments win over
 * dynamic ones, so "available" is never mistaken for a room id.
 */

import { handle, ok } from "@/server/lib/http";
import {
  RoomAvailabilityQuerySchema,
  equipmentParam,
  parseQuery,
} from "@/lib/validators";
import { findAvailableRooms } from "@/server/services/rooms.service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request) {
  return handle(async () => {
    const q = parseQuery(RoomAvailabilityQuerySchema, req.url);
    const equipment = equipmentParam(req.url);
    return ok(
      await findAvailableRooms({
        date: q.date,
        start_time: q.start_time,
        end_time: q.end_time,
        ...(q.min_capacity === undefined ? {} : { min_capacity: q.min_capacity }),
        ...(q.type ? { type: q.type } : {}),
        ...(equipment ? { equipment } : {}),
      }),
    );
  });
}
