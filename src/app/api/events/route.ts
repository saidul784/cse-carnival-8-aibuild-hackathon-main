import { handle, ok, created, readJson } from "@/server/lib/http";
import { EventQuerySchema, parseQuery } from "@/lib/validators";
import { createEvent, listEvents } from "@/server/services/events.service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request) {
  return handle(async () => {
    const filters = parseQuery(EventQuerySchema, req.url);
    return ok(await listEvents(filters));
  });
}

export async function POST(req: Request) {
  return handle(async () => created(await createEvent(await readJson(req))));
}
