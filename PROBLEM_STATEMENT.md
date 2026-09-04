# CampusOS — Problem Statement
### AI Build Hackathon · Challenge Brief

*An intelligent university platform powered by an AI agent that understands and acts on real-time campus data.*

---

## What This Is About

Every student knows the feeling. You rush in for a 9 AM class and the room is empty, and now you're scrolling the group chat trying to work out whether it moved or got cancelled, somewhere in the last 200 unread messages. Or you've got a free hour between classes and you actually want to use it, but you have no clue what's happening on campus right now. Or there's a deadline you completely forgot about until a friend mentions it like it's obvious.

The information exists somewhere. It's just scattered across notices, chats, spreadsheets, and people's memory, and never in one place when you need it.

Your challenge is to fix that. Build **CampusOS** — an app that keeps a student's campus information in one place and puts an AI agent on top of it that can actually answer questions and get things done. Not a toy chatbot that guesses, but an agent that reads the real data and acts on it.

---

## What You Will Build

Two parts that work together.

### Part 1 — The Campus Data Manager

This is the part that holds the data and lets people manage it. It is worth just as much as the agent, so build it properly.

We will hand you a starting dataset (JSON files) covering class schedules, rooms, events, announcements, and assignment deadlines. Your app loads it and displays it in a clean, usable interface with a clear section for each of the five systems. From there, a user should be able to actually change things, not just stare at them:

- **Add** a record — post a new announcement, create an event, add a class to the schedule
- **Edit** a record — fix a class time, update a room's capacity, change an event's details
- **Delete** a record — cancel a class, take down an expired notice, remove an event

What really matters is what happens after each change. Every add, edit, or delete should show up in the interface right away, with no manual refresh. Add an event and it appears in the list. Change a room's capacity and the new number is what you see. Delete a notice and it is gone from the board.

The change also has to be real, not just on screen. It is saved to your backend, so if someone reloads the page or reopens the app, everything is exactly as they left it. The dashboard should always reflect the current state — and that same current state is what the agent reads from. **A change made here becomes the new truth for the whole app.**

### Part 2 — The AI Agent

This is where a student just talks to CampusOS the way they would ask a helpful senior who somehow knows everything about campus.

The agent always works off the **current data**. So if someone updates a room or posts a notice through Part 1, the agent already knows about it the next time you ask. A good agent can look something up, stitch together an answer from a few different places, take an action when you ask it to, check back with you when your request is unclear, and say no when you are asking for something you should not be able to do.

---

## The Data You Will Work With

You will get seed data for five systems. Your app should let people view and fully manage (add, edit, delete) all five, plus the extra actions noted for rooms and events.

| System | Fields | What You Can Do |
|--------|--------|-----------------|
| Schedule | Course, time, room, day, instructor | View, add, edit, delete |
| Room | Room number, capacity, equipment | View, add, edit, delete, **book**, **cancel** |
| Event | Name, date, time, capacity | View, add, edit, delete, **register**, **cancel** |
| Announcement | Title, body, date, priority | View, add, edit, delete |
| Assignment | Course, title, deadline, status | View, add, edit, delete |

See [`schema/schema.md`](./schema/schema.md) for the exact field names and types.

---

## A Quick Example

Here is the exact kind of moment CampusOS is built for.

**Step 1.** In the dashboard, someone edits an announcement so that *"CSE321 class cancelled"* becomes *"CSE321 moved to Room 304 at 2:00 PM."*

**Step 2.** A few minutes later, a student opens the chat and asks, *"Where is my CSE321 class today?"*

**Step 3.** The agent checks the latest announcement and replies, *"CSE321 has been moved to Room 304 today at 2:00 PM."*

That is the whole idea. The data lives in your app, someone changed it a minute ago, and the agent already knows.

---

## What the Agent Should Handle

These are the kinds of things a student might actually throw at your agent on a normal day. Some are simple, some need a bit more thinking, and one or two are there to catch out a careless agent. They are not ranked or grouped — just handle as many as you can, and handle them well.

- *"When is my next class?"* — the tired-morning classic
- *"What have I got due this week?"*
- *"I am free until 2 — is there anything on campus I could drop into?"* — needs your schedule and the events list read together
- *"Book Room 302 tomorrow, 3 to 5 PM."* — check it is actually free, then book it
- *"I need a room for 5 people with a projector, tomorrow between 2 and 4."* — filter by time, size, and equipment all at once
- *"Just book me any room tomorrow afternoon."* — too vague — the agent should ask which time and room before touching anything

The best agents nail the everyday ones every single time, and stay sensible when a request is messy or a little sketchy.

See [`sample_queries/sample_queries.md`](./sample_queries/sample_queries.md) for the full list of test queries we will use during judging.

---

## The Rules

- Build it on **whatever you want**. Any language, any framework, any platform — web, mobile, desktop, or even a terminal app. No restrictions.
- Use **any LLM** you like (OpenAI, Gemini, Groq, Anthropic, or whatever you are comfortable with).
- The agent **must** use real tool calling / function calling to read and change data. Faking it with prompt chaining does not count.
- **Both parts have to be there**, and both have to run on our machine straight from your submission.

---

## What We Will Give You

Our GitHub repo will include:

- The seed data as five JSON files, ready to load
- Schema documentation with the exact field names and types
- A few sample queries so you know what we will be asking
- Submission details and the deadline

---

## What to Submit

Submit a link to your GitHub repository. Keep it public and include a README with clear steps to run everything locally — we will run it and talk to the agent ourselves.

See [`SUBMISSION.md`](./SUBMISSION.md) for full submission details.

---

## How We Will Score It

| Criteria | Marks |
|----------|-------|
| Data Management — backend data loaded and shown clearly in the interface | 20 |
| CRUD Operations — add, edit, and delete all work, and changes stay saved | 20 |
| AI Agent (broken down below) | 40 |
| UI / UX and Design — how usable, clear, and polished it is | 20 |
| **Total** | **100** |

### The AI Agent's 40 Marks Break Down Like This

| Criteria | Marks |
|----------|-------|
| Answering questions correctly across the data | 10 |
| Taking the right actions (booking a room, registering for an event, and so on) | 10 |
| Always using the latest data, so recent edits show up right away | 10 |
| Handling vague or unauthorized requests — asking when unclear, refusing when it should not act | 10 |

### Bonus Points

- Deploying the project live
- Clean, readable, well-organized code

---

> What we actually care about is whether it **works**. Correct answers, editing that saves properly, and an app people can genuinely use will beat a flashy demo that falls apart the moment we try something real.
