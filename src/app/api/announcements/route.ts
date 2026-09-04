import { handle, ok, created, readJson } from "@/server/lib/http";
import { AnnouncementQuerySchema, parseQuery } from "@/lib/validators";
import {
  createAnnouncement,
  listAnnouncements,
} from "@/server/services/announcements.service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request) {
  return handle(async () => {
    const filters = parseQuery(AnnouncementQuerySchema, req.url);
    return ok(await listAnnouncements(filters));
  });
}

export async function POST(req: Request) {
  return handle(async () =>
    created(await createAnnouncement(await readJson(req))),
  );
}
