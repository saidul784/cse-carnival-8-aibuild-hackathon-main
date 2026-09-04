import { handle, ok, readJson } from "@/server/lib/http";
import {
  deleteBooking,
  getBooking,
  updateBooking,
} from "@/server/services/rooms.service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Ctx = { params: Promise<{ id: string; bookingId: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  return handle(async () => {
    const { bookingId } = await params;
    return ok(await getBooking(bookingId));
  });
}

export async function PATCH(req: Request, { params }: Ctx) {
  return handle(async () => {
    const { bookingId } = await params;
    return ok(await updateBooking(bookingId, await readJson(req)));
  });
}

export { PATCH as PUT };

/** Cancel a booking. */
export async function DELETE(_req: Request, { params }: Ctx) {
  return handle(async () => {
    const { bookingId } = await params;
    return ok(await deleteBooking(bookingId));
  });
}
