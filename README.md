# Factory Data & Production Line

## Table of contents

- [Run it](#run-it)
- [Test it](#test-it)
- [The seeded dataset](#the-seeded-dataset)

---

## Run it

### Prerequisites

- **Node.js 22+**
- **Docker** with Compose v2 (for Postgres, fixtures, and the e2e suite's throwaway DB)

### 1. Configure

```bash
cp .env.example .env
# edit .env and set a real key:
openssl rand -base64 32        # paste into SECRETS_ENCRYPTION_KEY=
```

`.env` uses **in-network hostnames** (`postgres`, `fixtures`) because Compose services talk to
each other by service name. The locally-run backend overrides those to `localhost` on the command line — see
the `LOCAL_DB` variable below. (`COMMANDS.md` documents this in detail.)

```bash
npm install
```

### 2. Start the data layer

```bash
docker compose up -d --build   # postgres (both DBs + seed) + fixtures
```

### 3. Start the backend (local)

```bash
LOCAL_DB='postgres://celesnity:celesnity_app_pw_change_me@localhost:5432/celesnity'
DATABASE_URL="$LOCAL_DB" npm run start --workspace backend
# → http://localhost:3001/api   (migrations + seed run automatically on boot)
```

The seed pre-registers the two **secret-free** sources (Application API + supplier crawler) but **not** the
factory DATABASE source, you register that yourself from the UI with the masked credentials from `.env`
(`FACTORY_DB_*`).

### 4. Start the frontend (local)

```bash
npm run dev --workspace frontend      # → http://localhost:3000
```

- **Data Sources** (`/data-sources`): register/test/discover/select/collect each source; inspect run
  status/duration/counts/errors; preview the normalized records with source + run provenance.
- **Production Lines** (`/production`): six-station board (WIP, completed qty, freshness), batch table,
  and per-batch detail (canonical timeline + provenance + management actions).

---

## Test it

```bash
# backend: unit suite (no infra) + HTTP e2e suite (self-provisions a throwaway Postgres + fixtures via Docker)
npm test --workspace backend            # 159 tests / 19 suites
npm run test:e2e --workspace backend    #  17 tests /  1 suite

# fixtures: pagination, 503-retry, malformed row, loop-guard link
npm test --workspace fixtures

# frontend: helpers (format + api-url)
npm test --workspace frontend
```

## The seeded dataset

The boot seed writes a small, fully **joinable** reference dataset, include: 5 work orders, 8 batches across 2 lines,
covering all six steps, kept in exact lockstep across every source by `batchId`.
It intentionally includes the required edge cases: a duplicate DISPATCH (App API + factory DB), a conflicting duplicate SORTING
(different quantities → `QUANTITY_MISMATCH`), a late earlier-station event, a missing-data batch, a
stale batch, a manager-blocked batch, and a planned work order only batch, so all four states and
every indicator are represented out of the box.

Operational observations are **not** seeded they are produced by collecting from the sources, and the
factory DATABASE source is **not** seeded, so you register it and drive the masked-secret flow yourself.
