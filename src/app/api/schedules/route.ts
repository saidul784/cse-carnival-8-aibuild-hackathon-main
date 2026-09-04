import { handle, ok, created, readJson } from "@/server/lib/http";
import { ScheduleQuerySchema, parseQuery } from "@/lib/validators";
import {
  createSchedule,
  listSchedules,
} from "@/server/services/schedules.service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request) {
  return handle(async () => {
    const filters = parseQuery(ScheduleQuerySchema, req.url);
    return ok(await listSchedules(filters));
  });
}

export async function POST(req: Request) {
  return handle(async () => created(await createSchedule(await readJson(req))));
}
