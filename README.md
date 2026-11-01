# TokTickIT

TokTickIT is an IT service desk application (Account and Access, Hardware, Software, and Network
requests) built over four sprints:

| Lab | What it added |
|---|---|
| 1 | A minimal full-stack slice: **React UI → Express REST API → Prisma ORM → PostgreSQL** |
| 2 | The Requester ticketing MVP: create tickets with attachments, browse / search / filter, manage attachments |
| 3 | Real authentication and roles (Requester, IT Staff, Administrator), the Staff Queue and Ticket Detail, Public Comments and Internal Notes, user management |
| 4 | Actions Taken on a Ticket, the final Ticket workflow with a resolution gate, role dashboards and role-based landing, expired-session handling, and final hardening |

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React + TypeScript + Vite + Bootstrap (Zen Green theme) + React Router |
| Backend | Node.js + Express + TypeScript + Zod + Multer |
| Database | PostgreSQL + Prisma |
| Auth | Signed httpOnly session cookie (JWT, 8 hours), bcrypt password hashes |
| Testing | Vitest (unit and component) + Supertest (API) + Playwright (E2E, 3 viewports) |

## Prerequisites

- Node.js 18+ and npm
- A running PostgreSQL instance (local install, or via Docker, see below)

## Project structure

```
toktickit/
├── client/                  # React + Vite + Bootstrap frontend
│   ├── src/
│   │   ├── api/             # request() helper (handles 401), one module per resource
│   │   ├── components/      # layout/, routing/, ui/ (shared Modal, FormField, badges),
│   │   │                    # tickets/, staff/, actions/, comments/, notes/, attachments/
│   │   ├── config/          # shared labels (friendly Status/Priority/Role), landing, transitions
│   │   ├── context/         # AuthContext (session, expiry)
│   │   ├── hooks/           # URL-driven list state
│   │   ├── pages/           # Login, ChangePassword, RequesterDashboard, StaffDashboard,
│   │   │                    # MyTickets, CreateTicket, RequesterTicketDetail,
│   │   │                    # StaffTicketQueue, StaffTicketDetail, UserManagement
│   │   └── styles/theme.css # Zen Green design tokens
│   └── tests/lab-01 … lab-04/
├── server/                  # Express + TypeScript API
│   ├── prisma/              # schema.prisma, seed.ts, seedDemo.ts, migrations/ (+ rollback.sql)
│   ├── src/
│   │   ├── db/              # seedData.ts (idempotent reference + demo seed)
│   │   ├── http/            # errors, asyncHandler, authContext, errorHandler
│   │   ├── routes/ services/ validation/ upload/ auth/
│   └── tests/lab-01 … lab-04/
├── e2e/lab-02 … lab-04/     # Playwright specs (outside client/, see the note below)
├── artifacts/lab-0x/screenshots/   # Playwright screenshots (desktop / tablet / mobile)
├── docs/lab-01 … lab-04/    # specification, ui-spec, api-spec, tests, ai-use, reviewer
├── .gitignore
└── README.md
```

## Setup

### 1. Database (PostgreSQL)

Run Postgres locally, or via Docker with credentials matching `server/.env.example`:

```bash
docker run -d --name toktickit-postgres \
  -e POSTGRES_USER=toktickit \
  -e POSTGRES_PASSWORD=toktickit \
  -e POSTGRES_DB=toktickit \
  -p 5432:5432 \
  postgres:16-alpine
```

Docker Desktop must be running first; `docker start` and `docker run` fail otherwise. If the container
already exists, `docker start toktickit-postgres` is enough.

### 2. Server

```bash
cd server
npm install
cp .env.example .env       # edit DATABASE_URL / PORT / CLIENT_ORIGIN if needed
npx prisma migrate dev     # applies every migration (Labs 1-4), including the additive Lab 4 one
npm run prisma:seed        # idempotent reference data and the demo accounts (see below)
npm run prisma:seed:demo   # optional, idempotent: demo tickets in every status, with Actions Taken
npm run dev                # starts the API on http://localhost:3000
```

Running either seed again adds nothing that already exists.

**Lab 4 migration and rollback.** The Lab 4 migration (`prisma/migrations/…_lab4_actions_taken/`) is purely
additive: it creates the `ActionTaken` table, adds `version` and `resolvedAt` to `Ticket`, adds dashboard
indexes, and backfills `resolvedAt` for Tickets that are already Resolved or Closed and `itPriority` where it
was empty. Nothing is dropped or rewritten, so earlier data is untouched. A tested recovery script sits beside
it as `rollback.sql`; after running it, mark the migration rolled back with
`npx prisma migrate resolve --rolled-back <migration folder name>`.

### 3. Client

```bash
cd client
npm install
cp .env.example .env       # edit VITE_API_URL if the API isn't on :3000
npm run dev                # starts the frontend on http://localhost:5173
```

Open http://localhost:5173 and sign in.

### Demo accounts

Every seeded account uses the dev-only password `Password123!` (never a real secret). Each role lands on its own
Dashboard after signing in.

| Role | Email | Lands on |
|---|---|---|
| Requester | `jennifer.anderson@example.com`, `michael.brown@example.com`, `sarah.johnson@example.com` | `/dashboard` |
| IT Staff | `priya.natarajan@example.com`, `carlos.mendes@example.com`, `emma.wilson@example.com` | `/staff/dashboard` |
| Administrator | `olivia.grant@example.com` | `/staff/dashboard` (plus a Users summary) |

`david.lee@example.com` is seeded as a Requester who must change their password at first sign-in;
`alex.wong@example.com` and `tom.baker@example.com` are inactive accounts that cannot sign in.

### A short demo

1. Sign in as `jennifer.anderson@example.com`, create a ticket (with an attachment), then open the Dashboard.
2. Sign in as `priya.natarajan@example.com` (another browser or a private window): the new ticket is in
   *Unassigned*. Open it, **Claim** it, set an IT Priority, and move it to *In Progress*.
3. Under **Actions Taken** choose **Add Action**, assign it to a colleague, and later **Complete** it with a result.
4. Try *Resolved* before the work is done: the resolution gate explains what is missing. Complete or cancel the open
   actions, then Resolve and Close the ticket.
5. As the Requester, refresh the Dashboard to see the counts change, and open the ticket to see every action read-only.
6. As `olivia.grant@example.com`, open **Users** to manage accounts.

## Testing

Each suite needs its own commands; all of them are expected to pass on `main`.

### API tests (Vitest + Supertest, against a dedicated test database)

```bash
cd server
cp .env.test.example .env.test    # a SEPARATE database from the dev one
# create it once: psql -U toktickit -c "CREATE DATABASE toktickit_test;"
npm run test:db:push              # applies migrations to the test database
npm test                          # all server tests
npm run typecheck && npm run build
```

### Frontend component tests (Vitest + Testing Library)

```bash
cd client
npm test
npx tsc --noEmit && npm run build
```

### End-to-end tests (Playwright, 3 viewports, against the real dev servers and dev database)

```bash
cd client
npx playwright install chromium   # one-time browser download
npm run e2e                       # starts both dev servers automatically (Docker/Postgres must be up)
```

The E2E suite runs at desktop (1280), tablet (768) and mobile (375) and also checks for horizontal scrolling
and keyboard use. Things to know before running it:

- It runs against the **dev database** and creates tickets, actions and a few users; it never deletes data.
- The Lab 3 authentication spec changes the seeded password of `sarah.johnson@example.com`; if you need that
  account afterwards, reset it from **Users** as the Administrator.
- It rewrites the screenshots under `artifacts/lab-0x/screenshots/`.
- `e2e/` lives outside `client/`'s `node_modules` tree (per the required repository structure), so Node cannot
  resolve `@playwright/test` from a spec file by default. Fix this once per machine with a junction at the
  repo root:

```powershell
New-Item -ItemType Junction -Path "node_modules" -Target "client\node_modules"
```

Test files live under `server/tests/lab-0x/`, `client/tests/lab-0x/` and `e2e/lab-0x/`, and each lab's planned
tests, traceability and final results are in `docs/lab-0x/tests.md`.

## Environment variables

Never commit a real `.env` or `.env.test` file. Copy the provided `.env.example` / `.env.test.example` in
`client/` and `server/` and fill in local values; both real files are git-ignored.

| Variable | Where | Purpose |
|---|---|---|
| `DATABASE_URL` | `server/.env` | Dev database connection |
| `PORT` | `server/.env` | API port (default 3000) |
| `CLIENT_ORIGIN` | `server/.env` | Allowed CORS origin (the client sends the session cookie) |
| `UPLOAD_DIR` | `server/.env` | Attachment storage root (default `./uploads`) |
| `JWT_SECRET` | `server/.env` | Signs the session cookie. Optional in development (an insecure default is used), **required** when `NODE_ENV=production` |
| `DATABASE_URL` | `server/.env.test` | **Separate** test database, truncated on every test run |
| `VITE_API_URL` | `client/.env` | Base URL the frontend calls |

## Documentation

Every lab keeps its documents under `docs/lab-0x/`:

- **Lab 1:** `ai_use.md`, `tests.md`, `reviewer.md`
- **Labs 2-4:** `specification.md` (requirements, business rules, acceptance criteria, Definition of Done),
  `ui-spec.md` (Zen Green theme and per-screen specification, plus the visual and accessibility checklist),
  `api-spec.md` (REST contract), `tests.md` (planned tests, traceability, final results), `ai-use.md`
  (AI coding agent prompts and reflection), `reviewer.md` (peer review record)
