/**
 * Dashboard statistics.
 *
 * `?view=counts` and `?view=health` return the cheaper projections; the
 * default returns the full overview the landing page needs in one round trip.
 */

import { handle, ok } from "@/server/lib/http";
import {
  getCounts,
  getHealth,
  getOverview,
} from "@/server/services/stats.service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request) {
  return handle(async () => {
    const view = new URL(req.url).searchParams.get("view");
    if (view === "counts") return ok(await getCounts());
    if (view === "health") return ok(await getHealth());
    return ok(await getOverview());
  });
}
