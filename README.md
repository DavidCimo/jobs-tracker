# Jobs Tracker

Small job-search tracker.
A React app on top of a Postgres database.
The database runs on Supabase or on your own machine.

## Layout

| Path | What |
|---|---|
| `supabase/migrations/0001_init.sql` | Schema: companies, jobs, job_events, contacts, skipped_listings, daily_runs, views, RPCs. |
| `db/local/` | Extra SQL for plain Postgres: the `anon` role and grants Supabase normally creates. |
| `docker-compose.yml` | Local Postgres 17 + PostgREST. |
| `app/` | Vite + React + TS app. |

## Setup — local Postgres

Needs Docker.

1. `docker compose up -d`
   - Postgres on port 5432, PostgREST API on port 3000.
   - The schema is applied on first start.
   - Ports taken? Run `PG_PORT=5433 API_PORT=3001 docker compose up -d` and change the URL below.
2. `cp app/.env.example app/.env` and set:
   - `VITE_DB=postgres`
   - `VITE_POSTGREST_URL=http://localhost:3000`
3. `cd app && npm install && npm run dev`

Connect with psql: `psql postgres://postgres:postgres@localhost:5432/jobs`.
Wipe everything: `docker compose down -v`.

## Setup — Supabase

1. Create a Supabase project.
2. In the SQL editor run `supabase/migrations/0001_init.sql`.
3. `cp app/.env.example app/.env` and set:
   - `VITE_DB=supabase`
   - `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from the project settings.
4. `cd app && npm install && npm run dev`

## Optional settings

In `app/.env`:
- `VITE_APP_TAGLINE`: text shown next to the title.
- `VITE_DEFAULT_LOCATION`: pre-filled location in the Add job form.

## Pipeline statuses

`saved → applied → interview → offer`, with `rejected`, `expired`, `withdrawn` as exits.
Changing status writes a `job_events` row.
Setting `applied` stamps `applied_at`.
`expire_stale_jobs()` moves `saved` jobs whose deadline passed to `expired`.

## Filling it automatically

Any script or agent can add jobs through the API:
- `POST /rpc/add_job` creates a company if needed and a `saved` job.
- `known_listings` lists every company + role already seen, for dedupe.
- `skipped_listings` and `daily_runs` hold rejected listings and run briefs.

On Supabase the API base is `https://<ref>.supabase.co/rest/v1`.
Locally it is `http://localhost:3000`.

## Security

No auth. The `anon` role has full access.
Local use only. Do not expose it publicly without adding auth.
