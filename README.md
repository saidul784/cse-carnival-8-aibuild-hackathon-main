# CampusOS

An intelligent university platform for the AUST CSE department: a dashboard that manages five campus data systems, and an AI agent that answers questions and takes actions against the **live database** using real tool calling.

Built for the AUSTPIC AI Build Hackathon. The challenge brief is in [`PROBLEM_STATEMENT.md`](./PROBLEM_STATEMENT.md).

---

## Project overview

CampusOS loads the five seed JSON files in `data/` into a real SQLite database on first run, then never reads them again. Everything after that — the dashboard and the agent alike — reads and writes through one shared service layer, so a change made in the interface becomes the new truth for the whole app immediately. The agent has no built-in knowledge of the campus: every class, room, event, notice and deadline it mentions arrives from a tool call executed against the database at that moment, which is why an announcement edited in the dashboard is reflected in the very next answer.

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router), React 19, TypeScript |
| UI | Tailwind CSS, shadcn/ui-style components, TanStack Query |
| Database | SQLite via Prisma 6 |
| Validation | Zod (shared by the API and the agent's tools) |
| LLM | Anthropic, OpenAI, Groq or Google Gemini — pick one |

Frontend, API and agent all run in **one process on one port**.

---

## Setup

Requires **Node.js 18.18+** (developed on 24.x).

```bash
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

Open <http://localhost:3000>.

`npm install` runs `prisma generate` automatically. `db:migrate` creates `prisma/dev.db`; `db:seed` loads all 67 seed records. Seeding is idempotent — re-running it will never duplicate rows or overwrite your changes.

To use the AI assistant, add an API key first:

```bash
cp .env.example .env
```

Then edit `.env` and set **one** provider key. The dashboard works fully without a key; only the chat page needs one.

## Environment variables

| Key | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | SQLite file. Default `file:./dev.db`. |
| `LLM_PROVIDER` | no | `anthropic` \| `openai` \| `groq` \| `google`. Blank auto-detects whichever key is set. |
| `ANTHROPIC_API_KEY` | one of these | Anthropic key. |
| `OPENAI_API_KEY` | one of these | OpenAI key. |
| `GROQ_API_KEY` | one of these | Groq key. |
| `GOOGLE_API_KEY` | one of these | Google Gemini key. |
| `ANTHROPIC_MODEL` / `OPENAI_MODEL` / `GROQ_MODEL` / `GOOGLE_MODEL` | no | Override the default model. |
| `PORT` | no | Defaults to 3000. |
| `DEMO_STUDENT_ID` / `DEMO_STUDENT_NAME` / `DEMO_ROLE` | no | Identity the agent acts as. See below. |
| `DEMO_NOW` | no | Pin the app's idea of "now" to an ISO timestamp. Unset uses the real clock. |

Keys are read server-side only and never reach the browser. `.env` is git-ignored.

> **Note on dates.** The seed data is set in **September 2026**. If you run this outside that window, relative queries ("due this week", "tomorrow") will correctly return little or nothing, because the seeded deadlines and events are in the past. To see the app as intended, set `DEMO_NOW=2026-09-04T10:00:00` in `.env`.

> **Note on identity.** `schema/schema.md` defines no student entity, so "my classes" and "register me" need an identity. It defaults to a demo student (`20-40600`) who is deliberately *not* in any seed roster, so the sample registration query works. Change it with `DEMO_STUDENT_ID` / `DEMO_STUDENT_NAME`. The active identity is shown at the top of the chat page.

---

## Using the agent

Open **AI Assistant** in the sidebar. Every answer expands to show the exact tools it called, with arguments and timings — that trace is the evidence the answer came from the database rather than the model's imagination.

Things it handles:

- **Lookups** — "When is my next class?", "What classes do I have on Wednesday?", "Show me all high priority announcements."
- **Multi-source reasoning** — "I'm free until 2 PM, is there anything on campus I could drop into?", "Which labs have a projector and can fit at least 30 people?"
- **Actions** — "Book Room 7A02 tomorrow from 3 PM to 5 PM.", "Register me for the Guest Lecture on Deep Learning."
- **Asking back** — "Just book me any room tomorrow afternoon" gets a question about which room and which times, and books nothing.
- **Refusing** — it will not delete records, post official announcements, edit the timetable, change marks, or touch another student's bookings.

Try editing an announcement in the dashboard and then asking the agent about it. The change shows up immediately.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and serve |
| `npm run typecheck` | TypeScript, no emit |
| `npm run db:migrate` | Apply migrations |
| `npm run db:seed` | Load `data/*.json` (idempotent) |
| `npm run db:studio` | Browse the database |
| `npm run verify` | Run the official sample queries |

`npm run verify` runs the queries from `sample_queries/sample_queries.md` through the full LLM + tool loop when a key is configured. Without one it falls back to `--tools` mode, which drives the same tools directly and checks each result against the database — deterministic, no key needed.

## Project structure

```
data/                     read-only seed files — never written to at runtime
prisma/                   schema, migration, idempotent seeder
scripts/verify-queries.ts official sample query verification
src/
  app/                    pages + API routes
  components/             layout, shared UI, chat
  server/
    services/             all business logic (CRUD, availability, capacity)
    lib/                  time, overlap, ids, errors, http
  agent/
    index.ts              the tool-calling loop
    prompt.ts  policy.ts  system prompt, permissions
    providers/            anthropic · openai · groq · gemini
    tools/                read + action tools, registry, schemas
```

The dashboard's API routes and the agent's tools are thin wrappers over the **same service layer**, which is what makes it structurally impossible for the agent to read stale data.

---

## Licence

MIT — see [`LICENSE`](./LICENSE).
