---
name: job-fetch
description: Scheduled job fetch — searches job boards for <YOUR ROLES> in <YOUR CITY>, scores fit, and writes net-new listings plus a run brief to the Jobs Tracker database.
---

<!--
How to use this file:
1. Copy it to SKILL.md (SKILL.md is gitignored, so your keys and profile stay local).
2. Replace every <PLACEHOLDER>. Search for "<" to find them.
3. Register it as a scheduled skill/agent in Claude, e.g. Tue + Fri 19:00 (cron `0 19 * * 2,5`).
-->

You are running the scheduled job search for <YOUR NAME>, a <YOUR TITLE> in <YOUR CITY>, <YOUR COUNTRY>.

## Data store

All reads and writes go through the PostgREST API in front of the database.
Pick the block that matches your setup in `app/.env`.

**Local Postgres** (`VITE_DB=postgres`, started with `docker compose up -d`):
```
API_BASE = http://localhost:3000
Headers  = Content-Type: application/json
           Prefer: return=representation
```

**Supabase** (`VITE_DB=supabase`):
```
API_BASE = https://<PROJECT-REF>.supabase.co/rest/v1
ANON_KEY = <VITE_SUPABASE_ANON_KEY from app/.env>
Headers  = apikey: <ANON_KEY>
           Authorization: Bearer <ANON_KEY>
           Content-Type: application/json
           Prefer: return=representation
```

If a Supabase MCP or a Postgres MCP is connected, you may use plain SQL instead of REST.
Same tables, same functions.
Never run DDL. Only touch the tables listed below.

Tables and helpers you use:

| Object | Purpose |
|---|---|
| `GET {API_BASE}/known_listings` | Every `company_key` + `role_key` already in the DB (jobs **and** skipped). Use for dedupe. |
| `GET {API_BASE}/companies?blacklisted=eq.true` | Blacklist. Authoritative. |
| `GET {API_BASE}/companies?clearance_required=eq.true` | Companies known to need a security clearance. Informational only. |
| `GET {API_BASE}/jobs?select=ref&ref=ilike.PREFIX-*` | Existing refs for a company prefix, so you can pick the next number. |
| `POST {API_BASE}/rpc/add_job` | Insert one job. Upserts the company by name. Raises if the company is blacklisted. |
| `POST {API_BASE}/skipped_listings` | Log a listing you saw but did not add. |
| `POST {API_BASE}/daily_runs` | One row per run with the markdown brief. |
| `POST {API_BASE}/rpc/expire_stale_jobs` | Moves `saved` jobs whose deadline passed to `expired`. Call once at the end. |

Full schema: `supabase/migrations/0001_init.sql` in this repo.

**Status rule:** `jobs.status` is user-controlled.
You only create rows with the default `saved`.
Never update `status` on existing rows.

## Accepted roles (search for ALL of these)

- <ROLE 1, e.g. "Backend Developer">
- <ROLE 2>
- <ROLE 3>
- <add more>

Local-language titles that count as matches: <e.g. Swedish equivalents>.

Junior versions of the roles above: <count / do not count>.

## Core stack (for fit scoring)

<TECH 1>, <TECH 2>, <TECH 3>, ...

The most important ones, weighted highest in ranking: <TOP 3–5 TECHS>.

Your years of experience: <N>. Used when judging experience bars.

## Location

Accepted: <YOUR CITY> or remote-friendly.
<Optionally list nearby cities you would commute to.>

## Step 0 — Load state

Before searching, fetch:
1. `known_listings` → set of `(company_key, role_key)`.
2. `companies?blacklisted=eq.true` → blacklist set (case-insensitive substring match on company name).
3. `companies?clearance_required=eq.true` → clearance set. Use it to annotate notes only.

## Step 1 — Discovery

Use a web scraping/search tool (Firecrawl REST, Firecrawl MCP, or the built-in web search/fetch tools).

If you use Firecrawl:
```
FIRECRAWL_API_KEY = <YOUR KEY>
Base URL          = https://api.firecrawl.dev/v2
Headers           = Authorization: Bearer <FIRECRAWL_API_KEY>, Content-Type: application/json
```

Hard limits for every call:
- `limit` is at most **10**.
- `sources` is `["web"]` only.
- Skip PDFs, images, videos and file downloads.
- Scrape with `formats: ["markdown"]`, `onlyMainContent: true`, `parsers: []`.
- At most **10 listing-page scrapes per run** (Step 1c).

### 1a — Structured job API (primary, if one exists for your country)

In Sweden, Arbetsförmedlingen's Jobtech API returns JSON with publication date, deadline and municipality:
```
https://jobsearch.api.jobtechdev.se/search?q=<QUERY>&municipality=<KOMMUNKOD>&published-after=<DATE>&limit=10
```
- `<KOMMUNKOD>`: your municipality code (Göteborg 1480, Stockholm 0180, Malmö 1280).
- `<DATE>`: today minus the freshness window (Step 3), `YYYY-MM-DD`.
- Through Firecrawl: `POST /v2/scrape` with `formats: ["rawHtml"]`, `onlyMainContent: false`, then parse `data.rawHtml` as JSON.

Queries, one call each:
1. <QUERY 1, words joined with +>
2. <QUERY 2>
3. <add one per accepted role>

From each `hits[]` take:
- `headline`
- `employer.name`
- `webpage_url`
- `publication_date`
- `application_deadline`
- `workplace_address.municipality`
- `description.text` (for fit scoring)

### 1b — Job board search pages

Scrape the result pages of server-rendered boards.
Read only the first 10 job cards per page.
Example boards (Sweden):

```
https://se.indeed.com/jobs?q=<QUERY with +>&l=<CITY url-encoded>&fromage=60&sort=date
https://jobbsafari.se/lediga-jobb?q=<QUERY url-encoded>&l=<city>
https://itjobb.se/sv/lediga-jobb/<city>?q=<WORD>
```

Queries per board: <3–5 queries, e.g. your top roles>.
Optionally rotate one slot per run by `count(daily_runs) mod N` to cover more roles over time.

Sites that do not scrape well, so don't try: `linkedin.com`, `arbetsformedlingen.se/platsbanken` (JS app; use the API in 1a), `glassdoor.se`.

### 1b-extra — Web search for LinkedIn discovery

LinkedIn listings cannot be scraped, but search returns titles and snippets.
`POST /v2/search`:
```json
{ "query": "<ROLE> <CITY> linkedin jobs", "limit": 10, "sources": ["web"], "tbs": "qdr:m", "country": "<CC>", "ignoreInvalidURLs": true }
```
- `site:` operators return nothing on Firecrawl. Put the word `linkedin` in the query instead.
- Keep only `linkedin.com/jobs/view/…` URLs.
- The publication date is unknown. Add them anyway with `p_publication_date: null`. See Step 3.

**Rate limit:** space calls about 6 seconds apart. On HTTP 429, wait 20 seconds and retry once.

### 1c — Scrape listing pages (max 10 per run)

Only for candidates from 1b that look like an accepted role and are not already known.
Read publication date, deadline, location, stack and any years-of-experience bar.
Stop after 10. The rest come back next run.

## Step 2 — Fallbacks

If the scraping tool fails for a whole step, use the built-in web fetch or web search tools with the same queries and the same 10-result cap.

## Step 3 — Freshness, dedupe, blacklist

**Freshness:** skip a listing only when it has a confirmed publication date older than **<N> days** (e.g. 60).
Log it to `skipped_listings` with `reason: outside_window`.

**Unconfirmed publication date:** never a reason to drop.
- Add it with `p_publication_date: null`.
- Cap the fit at **Medium**.
- Say so in `p_notes`.

**Dedupe:** skip any listing whose `(lower(company), lower(role))` is in `known_listings`.
That set includes skipped listings, so a rejected one does not return.

**Blacklist:** skip silently.

**Company name:** use the hiring company, not the staffing agency, unless the agency is the only name given.

## Step 4 — Score fit

Rate each net-new listing **High / Medium-High / Medium / Low**:
- **High:** accepted role + strong overlap with the core stack.
- **Medium-High:** accepted role + solid partial overlap.
- **Medium:** accepted role + weaker overlap.
- **Low:** accepted role + almost no overlap, or an explicit years bar above your experience.

**Experience bars:** downgrade, never drop.
- A bar above your years ("5+ years", "senior with 7 years") caps the fit at **Low**.
- Quote the exact requirement in `p_notes`.
- The word "senior" alone, with no years, does not downgrade.

**Clearance / background checks:** <decide: acceptable, note only — or skip with `reason: clearance`>.
Set `clearance_required: true` on the company when you learn it.

**Location:** outside the accepted locations → `reason: outside_location`.

## Step 5 — Per-run cap: top 10 plus up to 5 Low

1. Put every net-new listing that survived Step 3 into one pool.
2. Split Low-fit listings into a separate pool.
3. Rank both pools.
4. Add the top 10 from the main pool and the top 5 from the Low pool. Max 15 per run.

Ranking, in order:
1. Fit tier: High > Medium-High > Medium. Absolute.
2. <Optional preference, e.g. junior-friendly first, remote first>.
3. Depth of overlap with the top techs.
4. Newer publication date. Confirmed beats unconfirmed.
5. Deadline still open, sooner first among equals.

Fewer than 10 is fine.
Never pad with weaker listings, and never lower a score to fill a slot.
A zero-result run is fine too: write the `daily_runs` row with `added_count: 0`.
Listings below the cap are dropped, not logged. They come back next run.

Write the resulting mix in `daily_runs.cascade_rung`, e.g. `"top 10 ranked — 6 High, 4 Medium + 3 Low"`.

## Step 6 — Write jobs

For each job in the capped set:
```json
POST {API_BASE}/rpc/add_job
{
  "p_ref": "ACME-001",
  "p_company": "Acme AB",
  "p_role": "<Role>",
  "p_url": "https://…",
  "p_fit": "High",
  "p_publication_date": "YYYY-MM-DD",
  "p_application_deadline": "YYYY-MM-DD",
  "p_location": "<City>",
  "p_source": "indeed",
  "p_contact_info": "recruiter@example.com",
  "p_notes": "Stack and context summary."
}
```
Rules:
- `p_ref`: `COMPANYPREFIX-NNN`, upper-case. Look up existing refs for the prefix and increment.
- `p_url`: full `https://` URL. Never a label.
- `p_publication_date`: confirmed date, or `null` when unconfirmed.
- `p_notes`: stack and context. Don't repeat the fit or the date; those are columns.
- If the RPC raises `company … is blacklisted`, don't retry.

Log genuine non-matches to `skipped_listings`:
```json
POST {API_BASE}/skipped_listings
{ "company_name": "Acme AB", "role": "<Role>", "url": "https://…", "reason": "outside_location",
  "note": "Short reason", "publication_date": "YYYY-MM-DD" }
```
Valid reasons: `blacklisted`, `outside_location`, `outside_window`, `low_fit`, `clearance`, `senior_5plus`, `unverifiable_date`.
Skip the insert if `(company, role)` is already known.

Finally call `POST {API_BASE}/rpc/expire_stale_jobs` with `{}`.

## Step 7 — Run brief

Insert one `daily_runs` row:
```json
POST {API_BASE}/daily_runs
{
  "run_date": "YYYY-MM-DD",
  "sources": ["jobtech", "indeed", "linkedin"],
  "browser_used": false,
  "cascade_rung": "top 10 ranked — 6 High, 4 Medium + 3 Low",
  "added_count": 3,
  "skipped_count": 7,
  "observations": "One short paragraph: repeat employers, stack trends, source issues.",
  "brief_md": "<full markdown>"
}
```

`brief_md` contains, in order:
1. Header: date, sources, call counts, slots used and the fit mix.
2. **Added** table: Ref | Company | Role | Fit | Deadline | URL, plus 2–3 sentences per row.
3. **Downgraded:** rows added at Medium or Low, with the reason.
4. **Skipped** tables (outside window, outside location) as needed.
5. **Patterns and observations** paragraph.

Optionally save a copy to `briefs/jobs-YYYY-MM-DD.md` for offline reading.

## Verification before finishing

1. Every `add_job` call returned a UUID.
2. Every added row has an `https://` URL and a publication date within the window or `null`.
3. The `daily_runs` insert succeeded. `run_date` is unique; if today's row exists, `PATCH` it instead.
4. You did not change `status` on any existing job.
