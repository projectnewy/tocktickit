# TokTickIT

TokTickIT is an IT service desk application (Account and Access, Hardware, Software, and Network
requests). Lab 1 builds a minimal full-stack vertical slice: **React UI → Express REST API → Prisma ORM
→ PostgreSQL DB**.

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React + TypeScript + Vite + Bootstrap |
| Backend | Node.js + Express + TypeScript |
| Database | PostgreSQL + Prisma |
| Testing | Vitest (frontend/unit) + Supertest (API) |

## Prerequisites

- Node.js 18+ and npm
- A running PostgreSQL instance (local install, or via Docker, see below)

## Project structure

```
toktickit/
├── client/          # React + Vite + Bootstrap frontend
├── server/          # Express + TypeScript API
│   ├── prisma/      # schema.prisma, seed.ts
│   ├── src/
│   └── tests/lab-01/
├── docs/lab-01/      # ai_use.md, tests.md, reviewer.md
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

### 2. Server

```bash
cd server
npm install
cp .env.example .env      # edit DATABASE_URL / PORT if needed
npx prisma migrate dev    # creates tables (from Issue 3 onward)
npm run prisma:seed       # seeds reference data (from Issue 3 onward)
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

```bash
# API tests (Vitest + Supertest)
cd server && npm test

# Frontend tests (Vitest + Testing Library)
cd client && npm test
```

Test files live under `server/tests/lab-01/` and `client/tests/lab-01/`, documented in
`docs/lab-01/tests.md`.

## Environment variables

Never commit a real `.env` file. Copy the provided `.env.example` in each of `client/` and `server/`
to `.env` and fill in local values; `.env` is git-ignored.

## Documentation

- `docs/lab-01/ai_use.md` — AI coding agent prompts and reflection
- `docs/lab-01/tests.md` — test plan and evidence
- `docs/lab-01/reviewer.md` — peer review record
