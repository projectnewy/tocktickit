# TokTickIT

TokTickIT is an IT service desk application (Account and Access, Hardware, Software, and Network
requests). Lab 1 built a minimal full-stack vertical slice (**React UI → Express REST API → Prisma ORM
→ PostgreSQL DB**). Lab 2 adds a full Requester-facing ticketing MVP on top of it: creating tickets with
attachments, browsing/searching/filtering them, and managing attachments — using a temporary
Development Requester selector standing in for real login (arriving in Lab 3).

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React + TypeScript + Vite + Bootstrap (Zen Green theme) + React Router |
| Backend | Node.js + Express + TypeScript + Zod + Multer |
| Database | PostgreSQL + Prisma |
| Testing | Vitest (frontend/unit) + Supertest (API) + Playwright (E2E, 3 viewports) |

## Prerequisites

- Node.js 18+ and npm
- A running PostgreSQL instance (local install, or via Docker, see below)

## Project structure

```
toktickit/
├── client/               # React + Vite + Bootstrap frontend
│   ├── src/
│   │   ├── api/           # request() helper, per-resource API modules
│   │   ├── components/    # layout/, ui/, tickets/, attachments/
│   │   ├── context/        # RequesterContext (selected Development Requester)
│   │   ├── hooks/          # useTicketListParams (URL-driven list state)
│   │   ├── pages/           # RequesterSelection, CreateTicket, MyTickets,
│   │   │                     RequesterTicketDetail, SystemCheck (Lab 1)
│   │   └── styles/theme.css # Zen Green design tokens
│   └── tests/lab-01/, tests/lab-02/
├── server/                # Express + TypeScript API
│   ├── prisma/            # schema.prisma, seed.ts, seedDemo.ts, migrations/
│   ├── src/
│   │   ├── db/             # seedData.ts (idempotent reference + demo seed)
│   │   ├── http/            # errors, asyncHandler, requesterContext, errorHandler
│   │   ├── routes/, services/, validation/, upload/
│   └── tests/lab-01/, tests/lab-02/
├── e2e/lab-02/             # Playwright spec (outside client/, see note below)
├── artifacts/lab-02/screenshots/  # Playwright screenshots (desktop/tablet/mobile)
├── docs/lab-01/, docs/lab-02/     # ai_use.md/ai-use.md, tests.md, reviewer.md,
│                                    specification.md, ui-spec.md, api-spec.md (Lab 2)
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

(Docker Desktop's GUI app must be running first — `docker start`/`docker run` fail otherwise.)

### 2. Server

```bash
cd server
npm install
cp .env.example .env      # edit DATABASE_URL / PORT / CLIENT_ORIGIN if needed
npx prisma migrate dev    # creates tables
npm run prisma:seed       # seeds reference data (categories, related systems, requesters)
npm run prisma:seed:demo  # optional: adds ~16 realistic demo tickets for screenshots/E2E
npm run dev                # starts the API on http://localhost:3000
```

### 3. Client

```bash
cd client
npm install
cp .env.example .env      # edit VITE_API_URL if the API isn't on :3000
npm run dev                # starts the frontend on http://localhost:5173
```

Open http://localhost:5173 in a browser.

## Testing

### API tests (Vitest + Supertest, against a dedicated test database)

```bash
cd server
cp .env.test.example .env.test    # a SEPARATE database from the dev one
# create it once: psql -U toktickit -c "CREATE DATABASE toktickit_test;"
npm test
```

### Frontend component tests (Vitest + Testing Library)

```bash
cd client && npm test
```

### End-to-end tests (Playwright, 3 viewports, against the real dev servers + dev database)

```bash
cd client
npx playwright install chromium   # one-time browser download
npm run e2e                        # starts both dev servers automatically
```

**One-time setup note:** `e2e/lab-02/` lives outside `client/`'s `node_modules` tree (per the required
repository structure), so Node can't resolve `@playwright/test` from a spec file there by default. Fix
once per machine with a `node_modules` junction at the repo root pointing into `client/node_modules`:

```powershell
New-Item -ItemType Junction -Path "node_modules" -Target "client\node_modules"
```

Test files live under `server/tests/lab-01/`, `server/tests/lab-02/`, `client/tests/lab-01/`,
`client/tests/lab-02/`, and `e2e/lab-02/`, documented in `docs/lab-01/tests.md` and
`docs/lab-02/tests.md`. E2E screenshots are saved to `artifacts/lab-02/screenshots/`.

## Environment variables

Never commit a real `.env` or `.env.test` file. Copy the provided `.env.example`/`.env.test.example` in
`client/` and `server/` and fill in local values — both are git-ignored.

| Variable | Where | Purpose |
|---|---|---|
| `DATABASE_URL` | `server/.env` | Dev database connection |
| `PORT` | `server/.env` | API port (default 3000) |
| `CLIENT_ORIGIN` | `server/.env` | Allowed CORS origin (Lab 2 — the client sends a custom header) |
| `UPLOAD_DIR` | `server/.env` | Attachment storage root (default `./uploads`) |
| `DATABASE_URL` | `server/.env.test` | **Separate** test database, truncated on every test run |
| `VITE_API_URL` | `client/.env` | Base URL the frontend calls |

## Documentation

**Lab 1:**
- `docs/lab-01/ai_use.md`, `docs/lab-01/tests.md`, `docs/lab-01/reviewer.md`

**Lab 2:**
- `docs/lab-02/specification.md` — sprint specification (FR/BR/AC, Definition of Done)
- `docs/lab-02/ui-spec.md` — Zen Green theme and per-screen UI specification
- `docs/lab-02/api-spec.md` — full REST API contract
- `docs/lab-02/tests.md` — planned-test table, traceability, and final results
- `docs/lab-02/ai-use.md` — AI coding agent prompts and reflection
- `docs/lab-02/reviewer.md` — peer review record
