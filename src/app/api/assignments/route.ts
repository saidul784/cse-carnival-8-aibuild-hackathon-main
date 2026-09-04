import { handle, ok, created, readJson } from "@/server/lib/http";
import { AssignmentQuerySchema, parseQuery } from "@/lib/validators";
import {
  createAssignment,
  listAssignments,
} from "@/server/services/assignments.service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request) {
  return handle(async () => {
    const filters = parseQuery(AssignmentQuerySchema, req.url);
    return ok(await listAssignments(filters));
  });
}

export async function POST(req: Request) {
  return handle(async () =>
    created(await createAssignment(await readJson(req))),
  );
}
