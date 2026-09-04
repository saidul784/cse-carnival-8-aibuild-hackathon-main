/**
 * Official sample query verification.
 *
 * Queries come verbatim from sample_queries/sample_queries.md and the
 * "What the Agent Should Handle" list in PROBLEM_STATEMENT.md. None are
 * invented or substituted.
 *
 * Two modes:
 *
 *   agent  — runs each query through the real LLM + tool-calling loop.
 *            Requires an API key. Reports the answer and the tools used.
 *   tools  — runs the exact tool calls each query requires, directly against
 *            the service layer, and checks the results against the database.
 *            Deterministic and needs no API key. This proves every tool the
 *            agent depends on returns the right answer; it does not prove the
 *            model picks the right tool.
 *
 *   npm run verify            auto: agent mode if a key is set, else tools
 *   npm run verify -- --tools force tool mode
 *   npm run verify -- --agent force agent mode
 */

process.env.DEMO_NOW ||= "2026-09-04T10:00:00";

import { configuredProviders } from "../src/agent/providers";
import { runAgent } from "../src/agent";
import { executeTool } from "../src/agent/tools/registry";
import { currentActor } from "../src/agent/policy";
import { db } from "../src/server/db";

const args = process.argv.slice(2);
const force = args.includes("--agent")
  ? "agent"
  : args.includes("--tools")
    ? "tools"
    : null;

const actor = currentActor();

let pass = 0;
let fail = 0;
const failures: string[] = [];
const cleanup: (() => Promise<unknown>)[] = [];

function h(title: string) {
  console.log(`\n${"=".repeat(72)}\n${title}\n${"=".repeat(72)}`);
}

function report(
  query: string,
  detail: {
    tools?: string[];
    status?: string;
    answer?: string;
    dbCheck?: string;
    ok: boolean;
    reason?: string;
  },
) {
  const verdict = detail.ok ? "PASS" : "FAIL";
  if (detail.ok) pass++;
  else {
    fail++;
    failures.push(`${query} — ${detail.reason ?? "no reason given"}`);
  }

  console.log(`\n▸ ${query}`);
  if (detail.tools) console.log(`   tools      : ${detail.tools.join(" → ") || "(none)"}`);
  if (detail.status) console.log(`   result     : ${detail.status}`);
  if (detail.answer) {
    const a = detail.answer.replace(/\s+/g, " ").trim();
    console.log(`   answer     : ${a.length > 300 ? a.slice(0, 300) + "…" : a}`);
  }
  if (detail.dbCheck) console.log(`   database   : ${detail.dbCheck}`);
  console.log(`   verdict    : ${verdict}${detail.reason ? ` — ${detail.reason}` : ""}`);
}

/* ------------------------------------------------------------------ *
 * Tool-mode helpers
 * ------------------------------------------------------------------ */

type Res = { ok: boolean; result: any; errorCode?: string };

async function call(name: string, a: Record<string, unknown> = {}): Promise<Res> {
  const out = await executeTool(name, a, actor);
  return { ok: out.ok, result: out.result as any, errorCode: out.errorCode };
}

/* ------------------------------------------------------------------ *
 * TOOL MODE — the nine official queries
 * ------------------------------------------------------------------ */

async function toolMode() {
  h("OFFICIAL SAMPLE QUERIES — tool layer (deterministic, no LLM)");
  console.log(`Clock pinned to ${process.env.DEMO_NOW}  ·  acting as ${actor.name} (${actor.student_id})`);

  // --- Simple lookups ---

  {
    const q = '"When is my next class?"';
    const now = await call("get_current_datetime");
    const r = await call("get_next_class");
    const s = r.result?.schedule;
    const ok =
      r.ok &&
      r.result?.date === "2026-09-06" &&
      s?.course === "CSE 4129" &&
      s?.start_time === "08:00" &&
      s?.room === "7A05";
    report(q, {
      tools: ["get_current_datetime", "get_next_class"],
      status: r.ok ? "ok" : `failed (${r.errorCode})`,
      answer: s ? `${s.course} — ${r.result.day} ${r.result.date}, ${s.start_time}–${s.end_time}, Room ${s.room}` : "none",
      dbCheck: `today=${now.result.date} (${now.result.day}, weekend=${now.result.is_weekend}); next class must skip Fri/Sat`,
      ok,
      reason: ok ? undefined : "expected CSE 4129 on 2026-09-06 08:00 in 7A05",
    });
  }

  {
    const q = '"What classes do I have on Wednesday?"';
    const r = await call("list_schedules", { day: "Wednesday" });
    const ok = r.ok && r.result?.count === 5;
    report(q, {
      tools: ["list_schedules"],
      status: r.ok ? "ok" : `failed (${r.errorCode})`,
      answer: r.result?.schedules?.map((s: any) => `${s.course} ${s.start_time}–${s.end_time} ${s.room}`).join("; "),
      dbCheck: `db has ${await db.schedule.count({ where: { day: "Wednesday" } })} Wednesday rows`,
      ok,
      reason: ok ? undefined : `expected 5 classes, got ${r.result?.count}`,
    });
  }

  {
    const q = '"What assignments do I have due this week?"';
    const r = await call("get_assignments_due_this_week");
    const w = r.result?.window;
    const ids = r.result?.assignments?.map((a: any) => a.id) ?? [];
    const ok =
      r.ok &&
      w?.start === "2026-09-06" &&
      w?.end === "2026-09-10" &&
      ids.includes("asgn-004") &&
      ids.includes("asgn-001") &&
      ids.includes("asgn-002");
    report(q, {
      tools: ["get_assignments_due_this_week"],
      status: r.ok ? "ok" : `failed (${r.errorCode})`,
      answer: r.result?.assignments?.map((a: any) => `${a.id} ${a.course} due ${a.deadline}`).join("; "),
      dbCheck: `window ${w?.label} (Sunday–Thursday academic week per schema.md)`,
      ok,
      reason: ok ? undefined : "expected asgn-004/001/002 inside 2026-09-06..10",
    });
  }

  {
    const q = '"Show me all high priority announcements."';
    const r = await call("list_announcements", { priority: "high" });
    const ids = (r.result?.announcements ?? []).map((a: any) => a.id).sort();
    const ok = r.ok && JSON.stringify(ids) === JSON.stringify(["ann-001", "ann-002", "ann-005", "ann-008"]);
    report(q, {
      tools: ["list_announcements"],
      status: r.ok ? "ok" : `failed (${r.errorCode})`,
      answer: ids.join(", "),
      dbCheck: `db has ${await db.announcement.count({ where: { priority: "high" } })} high-priority rows`,
      ok,
      reason: ok ? undefined : `expected ann-001/002/005/008, got ${ids.join(",")}`,
    });
  }

  // --- Multi-source reasoning ---

  {
    const q = '"I\'m free until 2 PM — is there anything on campus I could drop into?"';
    const now = await call("get_current_datetime");
    const ev = await call("find_events_in_window", { from_time: "10:00", to_time: "14:00" });
    const sch = await call("get_schedules_on_date", { date: now.result.date });
    // 2026-09-04 is a Friday: no classes, no events. The correct answer is an
    // honest "nothing today", not an error and not an invention.
    const ok = ev.ok && sch.ok && ev.result.events.length === 0 && sch.result.schedules.length === 0;
    report(q, {
      tools: ["get_current_datetime", "find_events_in_window", "get_schedules_on_date"],
      status: ev.ok && sch.ok ? "ok" : "failed",
      answer: `${ev.result?.events?.length ?? "?"} events and ${sch.result?.schedules?.length ?? "?"} classes in the window on ${now.result.date}`,
      dbCheck: `2026-09-04 is a ${now.result.day} (weekend) — zero events seeded on this date; agent must degrade gracefully`,
      ok,
      reason: ok ? undefined : "expected an empty but successful result",
    });
  }

  {
    const q = '"Which labs have a projector and can fit at least 30 people?"';
    const r = await call("list_rooms", { type: "lab", min_capacity: 30, equipment: ["projector"] });
    const nums = (r.result?.rooms ?? []).map((x: any) => x.room_number).sort();
    const expected = ["7B01", "7B02", "7B05", "7B06", "7B07", "7B08"];
    const ok = r.ok && JSON.stringify(nums) === JSON.stringify(expected);
    report(q, {
      tools: ["list_rooms"],
      status: r.ok ? "ok" : `failed (${r.errorCode})`,
      answer: nums.join(", "),
      dbCheck: "7B03 (cap 25) and 7B04 (cap 25, no projector) must be excluded",
      ok,
      reason: ok ? undefined : `expected ${expected.join(",")}, got ${nums.join(",")}`,
    });
  }

  // --- Actions ---

  {
    const q = '"Book Room 7A02 tomorrow from 3 PM to 5 PM."';
    const avail = await call("check_room_availability", {
      room: "7A02", date: "tomorrow", start_time: "3 PM", end_time: "5 PM",
    });
    const r = await call("book_room", {
      room: "7A02", date: "tomorrow", start_time: "3 PM", end_time: "5 PM", purpose: "verification",
    });
    let dbRow = null;
    if (r.ok) {
      dbRow = await db.booking.findUnique({ where: { booking_id: r.result.booking_id } });
      cleanup.push(() => call("cancel_room_booking", { booking_id: r.result.booking_id }));
    }
    const ok =
      avail.result?.available === true &&
      r.ok &&
      dbRow?.date === "2026-09-05" &&
      dbRow?.start_time === "15:00" &&
      dbRow?.end_time === "17:00" &&
      dbRow?.booked_by === actor.name;
    report(q, {
      tools: ["check_room_availability", "book_room"],
      status: r.ok ? `booked ${r.result.booking_id}` : `failed (${r.errorCode})`,
      answer: r.ok ? `${r.result.room_number} on ${r.result.date} ${r.result.start_time}–${r.result.end_time}` : JSON.stringify(r.result),
      dbCheck: dbRow ? `row persisted: ${dbRow.booking_id} ${dbRow.date} ${dbRow.start_time}-${dbRow.end_time} by ${dbRow.booked_by}` : "no row written",
      ok,
      reason: ok ? undefined : "booking not persisted with normalised 15:00–17:00 on 2026-09-05",
    });
  }

  {
    const q = '"Register me for the Guest Lecture on Deep Learning."';
    const before = await db.event.findUnique({ where: { id: "evt-002" } });
    const r = await call("register_for_event", { event: "Guest Lecture on Deep Learning" });
    const after = await db.event.findUnique({ where: { id: "evt-002" }, include: { registrations: true } });
    if (r.ok) cleanup.push(() => call("cancel_event_registration", { event: "evt-002" }));
    const ok =
      r.ok &&
      r.result.event_id === "evt-002" &&
      after?.registered === (before?.registered ?? 0) + 1 &&
      after?.registrations.some((x) => x.student_id === actor.student_id);
    report(q, {
      tools: ["register_for_event"],
      status: r.ok ? "registered" : `failed (${r.errorCode})`,
      answer: r.ok ? `${r.result.event_name} — ${r.result.registered_count}/${r.result.capacity}` : JSON.stringify(r.result),
      dbCheck: `registered ${before?.registered} → ${after?.registered}; roster row for ${actor.student_id} present: ${after?.registrations.some((x) => x.student_id === actor.student_id)}`,
      ok,
      reason: ok ? undefined : "fuzzy name did not resolve to evt-002, or count/roster not updated together",
    });
  }

  {
    const q = '"I need a room for 5 people with a projector, tomorrow between 2 and 4."';
    const r = await call("find_available_rooms", {
      date: "tomorrow", start_time: "2 PM", end_time: "4 PM", min_capacity: 5, equipment: ["projector"],
    });
    const nums = (r.result?.rooms ?? []).map((x: any) => x.room_number);
    const ok =
      r.ok &&
      nums.length > 0 &&
      !nums.includes("7B04") &&
      r.result.rooms.every((x: any) => x.equipment.includes("projector") && x.capacity >= 5) &&
      r.result.rooms[0].capacity <= r.result.rooms[r.result.rooms.length - 1].capacity;
    report(q, {
      tools: ["find_available_rooms"],
      status: r.ok ? `${r.result.count} rooms free` : `failed (${r.errorCode})`,
      answer: nums.slice(0, 6).map((n: string, i: number) => `${n}(${r.result.rooms[i].capacity})`).join(", ") + (nums.length > 6 ? " …" : ""),
      dbCheck: "7B04 must be excluded (no projector, and bk-002 occupies 14:00–16:00 on 2026-09-05); smallest suitable first",
      ok,
      reason: ok ? undefined : "filter or ordering wrong, or 7B04 leaked in",
    });
  }

  /* ---------------- Additional required checks ---------------- */

  h("EDGE CASES AND GUARDS");

  {
    const q = 'Nonexistent record — "Book Room 302 tomorrow, 3 to 5 PM." (PROBLEM_STATEMENT.md)';
    const r = await call("book_room", { room: "302", date: "tomorrow", start_time: "3 PM", end_time: "5 PM" });
    const ok = !r.ok && r.errorCode === "NOT_FOUND";
    report(q, { tools: ["book_room"], status: `${r.errorCode}`, answer: JSON.stringify(r.result), ok,
      reason: ok ? undefined : "room 302 must be reported missing, never invented" });
  }

  {
    // "AUST" matches evt-001 and evt-004. A genuinely ambiguous reference must
    // come back with the candidates so the agent can ask, never a silent pick.
    const q = 'Ambiguous request — "AUST" matches two events, must not guess';
    const evs = await db.event.findMany({ where: { name: { contains: "AUST" } } });
    const r = await call("register_for_event", { event: "AUST" });
    if (r.ok) cleanup.push(() => call("cancel_event_registration", { event: r.result.event_id }));
    const candidates = (r.result as any)?.details?.candidates;
    const ok = !r.ok && Array.isArray(candidates) && candidates.length === evs.length;
    report(q, {
      tools: ["register_for_event"],
      status: r.ok ? `PICKED ${r.result.event_id}` : `${r.errorCode}`,
      answer: JSON.stringify(r.result).slice(0, 260),
      dbCheck: `${evs.length} events contain "AUST": ${evs.map((e) => e.id).join(", ")}`,
      ok,
      reason: ok ? undefined : "an ambiguous name must return candidates, not register one",
    });
  }

  {
    const q = "Booking conflict — same window twice";
    const first = await call("book_room", { room: "7A01", date: "tomorrow", start_time: "10:00", end_time: "12:00", purpose: "v1" });
    if (first.ok) cleanup.push(() => call("cancel_room_booking", { booking_id: first.result.booking_id }));
    const clash = await call("book_room", { room: "7A01", date: "tomorrow", start_time: "11:00", end_time: "13:00", purpose: "v2" });
    const touch = await call("book_room", { room: "7A01", date: "tomorrow", start_time: "12:00", end_time: "13:00", purpose: "v3" });
    if (touch.ok) cleanup.push(() => call("cancel_room_booking", { booking_id: touch.result.booking_id }));
    const ok = first.ok && !clash.ok && clash.errorCode === "BOOKING_CONFLICT" && touch.ok;
    report(q, {
      tools: ["book_room ×3"],
      status: `first=${first.ok ? "ok" : first.errorCode}, overlap=${clash.errorCode}, back-to-back=${touch.ok ? "ok" : touch.errorCode}`,
      dbCheck: "10:00–12:00 blocks 11:00–13:00; 12:00–13:00 must be allowed (half-open intervals)",
      ok,
      reason: ok ? undefined : "overlap not rejected, or back-to-back wrongly rejected",
    });
  }

  {
    const q = "Event capacity — register for a full event (evt-006, 30/30)";
    const r = await call("register_for_event", { event: "evt-006" });
    const ok = !r.ok && r.errorCode === "EVENT_FULL";
    report(q, { tools: ["register_for_event"], status: `${r.errorCode}`, answer: JSON.stringify(r.result),
      dbCheck: "evt-006 is 30/30 with status full", ok,
      reason: ok ? undefined: "a full event must be refused" });
  }

  {
    const q = "Duplicate registration";
    const a = await call("register_for_event", { event: "evt-007" });
    if (a.ok) cleanup.push(() => call("cancel_event_registration", { event: "evt-007" }));
    const b = await call("register_for_event", { event: "evt-007" });
    const ok = a.ok && !b.ok && b.errorCode === "DUPLICATE_REGISTRATION";
    report(q, { tools: ["register_for_event ×2"], status: `first=${a.ok}, second=${b.errorCode}`, ok,
      reason: ok ? undefined : "second registration should be refused" });
  }

  {
    const q = "Invalid action — unauthorised tool is not exposed and is refused";
    const r = await call("delete_announcement", { id: "ann-001" });
    const still = await db.announcement.findUnique({ where: { id: "ann-001" } });
    const ok = !r.ok && still !== null;
    report(q, { tools: ["delete_announcement (not registered)"], status: `${r.errorCode}`, answer: JSON.stringify(r.result),
      dbCheck: `ann-001 still present: ${still !== null}`, ok,
      reason: ok ? undefined : "unauthorised action was not blocked" });
  }

  {
    const q = "Ownership — cancelling someone else's booking (bk-001, Nusrat Jahan)";
    const r = await call("cancel_room_booking", { booking_id: "bk-001" });
    const still = await db.booking.findUnique({ where: { booking_id: "bk-001" } });
    const ok = !r.ok && r.errorCode === "FORBIDDEN" && still !== null;
    report(q, { tools: ["cancel_room_booking"], status: `${r.errorCode}`, answer: JSON.stringify(r.result),
      dbCheck: `bk-001 still present: ${still !== null}`, ok,
      reason: ok ? undefined : "a student must not cancel another person's booking" });
  }

  {
    const q = "Invalid arguments are rejected before reaching the service";
    const r = await call("update_assignment_status", { assignment_id: "asgn-001", status: "done" });
    const ok = !r.ok && r.errorCode === "VALIDATION_ERROR";
    report(q, { tools: ["update_assignment_status"], status: `${r.errorCode}`, answer: JSON.stringify(r.result), ok,
      reason: ok ? undefined : "invalid enum should fail validation" });
  }

  {
    const q = "STALE DATA — dashboard edit is visible to the very next tool call";
    const before = await call("list_announcements", { priority: "high" });
    const beforeTitle = before.result.announcements.find((a: any) => a.id === "ann-001")?.title;

    await db.announcement.update({
      where: { id: "ann-001" },
      data: { title: "LIVE EDIT PROBE", body: "CSE 4113 moved to Room 7A04 at 15:30." },
    });

    const after = await call("list_announcements", { priority: "high" });
    const afterTitle = after.result.announcements.find((a: any) => a.id === "ann-001")?.title;

    const seed = JSON.parse(
      (await import("node:fs")).readFileSync("data/announcements.json", "utf-8"),
    ).find((a: any) => a.id === "ann-001");
    await db.announcement.update({
      where: { id: "ann-001" },
      data: { title: seed.title, body: seed.body },
    });

    const ok = afterTitle === "LIVE EDIT PROBE" && beforeTitle !== afterTitle;
    report(q, {
      tools: ["list_announcements ×2 around a direct DB edit"],
      status: ok ? "edit observed immediately" : "stale read",
      answer: `"${beforeTitle}" → "${afterTitle}"`,
      dbCheck: "restored to seed value afterwards",
      ok,
      reason: ok ? undefined : "the tool returned a cached value after the edit",
    });
  }

  {
    const q = "PERSISTENCE — a booking written by the agent survives a new Prisma connection";
    const r = await call("book_room", { room: "7C04", date: "tomorrow", start_time: "09:00", end_time: "10:00", purpose: "persistence probe" });
    let survives = false;
    if (r.ok) {
      const { PrismaClient } = await import("@prisma/client");
      const fresh = new PrismaClient();
      survives = (await fresh.booking.findUnique({ where: { booking_id: r.result.booking_id } })) !== null;
      await fresh.$disconnect();
      cleanup.push(() => call("cancel_room_booking", { booking_id: r.result.booking_id }));
    }
    report(q, { tools: ["book_room"], status: r.ok ? "written" : `${r.errorCode}`,
      dbCheck: `visible from a separate client: ${survives}`, ok: r.ok && survives,
      reason: r.ok && survives ? undefined : "write did not persist" });
  }
}

/* ------------------------------------------------------------------ *
 * AGENT MODE — full LLM + tool loop
 * ------------------------------------------------------------------ */

const OFFICIAL_QUERIES = [
  "When is my next class?",
  "What classes do I have on Wednesday?",
  "What assignments do I have due this week?",
  "Show me all high priority announcements.",
  "I'm free until 2 PM — is there anything on campus I could drop into?",
  "Which labs have a projector and can fit at least 30 people?",
  "Book Room 7A02 tomorrow from 3 PM to 5 PM.",
  "Register me for the Guest Lecture on Deep Learning.",
  "I need a room for 5 people with a projector, tomorrow between 2 and 4.",
];

const BEHAVIOUR_QUERIES = [
  { q: "Just book me any room tomorrow afternoon.", expect: "asks which room and time; performs NO booking" },
  { q: "Book Room 302 tomorrow, 3 to 5 PM.", expect: "says room 302 does not exist" },
  { q: "Register me for the Git & GitHub workshop.", expect: "refuses — event is full" },
  { q: "Delete all announcements.", expect: "refuses — not permitted" },
  { q: "Cancel Nusrat Jahan's booking bk-001.", expect: "refuses — not the requester's booking" },
];

async function agentMode() {
  h("OFFICIAL SAMPLE QUERIES — full agent (LLM + real tool calling)");
  console.log(`Clock pinned to ${process.env.DEMO_NOW}  ·  acting as ${actor.name}`);

  for (const q of OFFICIAL_QUERIES) {
    try {
      const r = await runAgent([{ role: "user", content: q }]);
      const writes = r.trace.filter((t) => t.isWrite && t.ok).map((t) => t.tool);
      for (const t of r.trace) {
        if (t.tool === "book_room" && t.ok) {
          const id = JSON.parse(t.resultPreview.replace(/…$/, ""))?.booking_id;
          if (id) cleanup.push(() => call("cancel_room_booking", { booking_id: id }));
        }
        if (t.tool === "register_for_event" && t.ok) {
          const ev = JSON.parse(t.resultPreview.replace(/…$/, ""))?.event_id;
          if (ev) cleanup.push(() => call("cancel_event_registration", { event: ev }));
        }
      }
      report(`"${q}"`, {
        tools: r.trace.map((t) => t.tool),
        status: `${r.rounds} round(s), ${r.trace.length} tool call(s)${writes.length ? `, writes: ${writes.join(",")}` : ""}`,
        answer: r.reply,
        ok: r.trace.length > 0 && r.reply.length > 0,
        reason: r.trace.length === 0 ? "no tool was called — the answer cannot be grounded in live data" : undefined,
      });
    } catch (e) {
      report(`"${q}"`, { ok: false, reason: e instanceof Error ? e.message : String(e) });
    }
  }

  h("BEHAVIOUR — vague and unauthorised requests");
  for (const { q, expect } of BEHAVIOUR_QUERIES) {
    try {
      const r = await runAgent([{ role: "user", content: q }]);
      const wrote = r.trace.some((t) => t.isWrite && t.ok);
      console.log(`\n▸ "${q}"`);
      console.log(`   expected   : ${expect}`);
      console.log(`   tools      : ${r.trace.map((t) => t.tool).join(" → ") || "(none)"}`);
      console.log(`   wrote data : ${wrote}`);
      console.log(`   answer     : ${r.reply.replace(/\s+/g, " ").slice(0, 300)}`);
      console.log(`   verdict    : REVIEW MANUALLY`);
    } catch (e) {
      console.log(`\n▸ "${q}"  ERROR: ${e instanceof Error ? e.message : e}`);
    }
  }
}

/* ------------------------------------------------------------------ */

async function main() {
  const providers = configuredProviders();
  const mode = force ?? (providers.length ? "agent" : "tools");

  console.log(`CampusOS — sample query verification`);
  console.log(`mode: ${mode}   configured providers: ${providers.join(", ") || "(none)"}`);

  if (mode === "agent" && providers.length === 0) {
    console.log(
      "\nAgent mode needs an API key. Set one of ANTHROPIC_API_KEY, OPENAI_API_KEY,\n" +
        "GROQ_API_KEY or GOOGLE_API_KEY in .env, or run with --tools.",
    );
    process.exitCode = 1;
    return;
  }

  if (mode === "agent") await agentMode();
  else await toolMode();

  h("CLEANUP");
  for (const fn of cleanup.reverse()) {
    try { await fn(); } catch (e) { console.log("  warn:", e instanceof Error ? e.message : e); }
  }
  const counts = {
    schedules: await db.schedule.count(),
    rooms: await db.room.count(),
    bookings: await db.booking.count(),
    events: await db.event.count(),
    registrations: await db.registration.count(),
    announcements: await db.announcement.count(),
    assignments: await db.assignment.count(),
  };
  console.log("  restored counts:", JSON.stringify(counts));

  h("SUMMARY");
  console.log(`${pass} passed, ${fail} failed`);
  if (failures.length) {
    console.log("\nFailures:");
    for (const f of failures) console.log(`  - ${f}`);
  }

  await db.$disconnect();
  if (fail > 0) process.exitCode = 1;
}

main().catch(async (e) => {
  console.error("HARNESS ERROR:", e);
  await db.$disconnect();
  process.exitCode = 1;
});
