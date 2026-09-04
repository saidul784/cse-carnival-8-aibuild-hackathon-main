import { handle, ok, created, readJson } from "@/server/lib/http";
import { BookingQuerySchema, parseQuery } from "@/lib/validators";
import {
  createBooking,
  listBookings,
  resolveRoom,
} from "@/server/services/rooms.service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Ctx) {
  return handle(async () => {
    const { id } = await params;
    const room = await resolveRoom(id);
    const q = parseQuery(BookingQuerySchema, req.url);
    return ok(await listBookings({ room_id: room.id, ...q }));
  });
}

/**
 * POST /api/rooms/:id/bookings
 * Overlap rejection lives in the service; a clash surfaces here as 409
 * BOOKING_CONFLICT with the offending bookings in `error.details`.
 */
export async function POST(req: Request, { params }: Ctx) {
  return handle(async () => {
    const { id } = await params;
    return created(await createBooking(id, await readJson(req)));
  });
}
