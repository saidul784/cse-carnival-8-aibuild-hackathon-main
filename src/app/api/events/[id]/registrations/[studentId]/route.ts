import { handle, ok } from "@/server/lib/http";
import { cancelRegistration } from "@/server/services/events.service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Ctx = { params: Promise<{ id: string; studentId: string }> };

/**
 * Cancel a registration. Decrements `registered` and removes the roster row in
 * one transaction; 404 REGISTRATION_NOT_FOUND if there was nothing to cancel,
 * never a silent success.
 */
export async function DELETE(_req: Request, { params }: Ctx) {
  return handle(async () => {
    const { id, studentId } = await params;
    return ok(await cancelRegistration(id, decodeURIComponent(studentId)));
  });
}
