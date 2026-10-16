-- jobs tracker / v2 — schema (Supabase or plain Postgres)
-- Clean-state migration. Run once on an empty project.

create extension if not exists pgcrypto;

create type fit_level as enum ('High', 'Medium-High', 'Medium', 'Low');

create type job_status as enum (
  'saved', 'applied', 'interview', 'offer', 'rejected', 'expired', 'withdrawn'
);

create type skip_reason as enum (
  'clearance', 'senior_5plus', 'outside_window', 'outside_location',
  'blacklisted', 'unverifiable_date', 'low_fit'
);

create type event_type as enum (
  'created', 'status_change', 'note', 'follow_up', 'contact', 'deadline_change'
);

-- ---------------------------------------------------------------- companies
create table companies (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  website            text,
  blacklisted        boolean not null default false,
  blacklist_reason   text,
  clearance_required boolean not null default false,
  notes              text,
  created_at         timestamptz not null default now()
);
create unique index companies_name_uq on companies (lower(name));

-- --------------------------------------------------------------------- jobs
create table jobs (
  id                   uuid primary key default gen_random_uuid(),
  ref                  text not null unique,              -- e.g. INTEGRO-005
  company_id           uuid not null references companies(id) on delete restrict,
  role                 text not null,
  url                  text not null check (url like 'https://%'),
  location             text,
  source               text,                              -- webbjobb.io, jobtech, linkedin, indeed, manual
  fit                  fit_level not null,
  status               job_status not null default 'saved',
  date_added           date not null default current_date,
  publication_date     date,
  application_deadline date,
  applied_at           date,
  follow_up_at         date,
  contact_info         text,
  notes                text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create unique index jobs_company_role_uq on jobs (company_id, lower(role));
create index jobs_status_idx on jobs (status);
create index jobs_deadline_idx on jobs (application_deadline);
create index jobs_follow_up_idx on jobs (follow_up_at);

-- --------------------------------------------------------------- job_events
create table job_events (
  id          uuid primary key default gen_random_uuid(),
  job_id      uuid not null references jobs(id) on delete cascade,
  type        event_type not null,
  from_status job_status,
  to_status   job_status,
  note        text,
  occurred_at timestamptz not null default now()
);
create index job_events_job_idx on job_events (job_id, occurred_at desc);

-- ----------------------------------------------------------------- contacts
create table contacts (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade,
  job_id     uuid references jobs(id) on delete set null,
  name       text not null,
  title      text,
  email      text,
  phone      text,
  linkedin   text,
  notes      text,
  created_at timestamptz not null default now()
);
create index contacts_company_idx on contacts (company_id);

-- --------------------------------------------------------- skipped_listings
-- Listings the daily run saw but did not add. Used for dedupe and manual review.
create table skipped_listings (
  id               uuid primary key default gen_random_uuid(),
  company_name     text not null,
  role             text not null,
  url              text,
  reason           skip_reason not null,
  note             text,
  publication_date date,
  seen_on          date not null default current_date,
  reviewed         boolean not null default false,
  created_at       timestamptz not null default now()
);
create unique index skipped_company_role_uq on skipped_listings (lower(company_name), lower(role));

-- --------------------------------------------------------------- daily_runs
-- One row per daily fetch, holding that day's brief.
create table daily_runs (
  id             uuid primary key default gen_random_uuid(),
  run_date       date not null unique,
  sources        text[] not null default '{}',
  browser_used   boolean not null default false,
  cascade_rung   text,                    -- e.g. "High top 5", "Medium-High expanded to 10"
  added_count    int not null default 0,
  skipped_count  int not null default 0,
  brief_md       text,                    -- full markdown brief
  observations   text,
  created_at     timestamptz not null default now()
);

-- ----------------------------------------------------------------- triggers
create or replace function jobs_touch_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger jobs_set_updated_at
  before update on jobs
  for each row execute function jobs_touch_updated_at();

create or replace function jobs_log_event() returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    insert into job_events (job_id, type, to_status, note)
    values (new.id, 'created', new.status, 'Added (' || new.fit || ')');
    return new;
  end if;

  if new.status is distinct from old.status then
    insert into job_events (job_id, type, from_status, to_status)
    values (new.id, 'status_change', old.status, new.status);
    if new.status = 'applied' and new.applied_at is null then
      new.applied_at := current_date;
    end if;
  end if;

  if new.application_deadline is distinct from old.application_deadline then
    insert into job_events (job_id, type, note)
    values (new.id, 'deadline_change',
            coalesce(old.application_deadline::text, 'none') || ' → ' ||
            coalesce(new.application_deadline::text, 'none'));
  end if;

  return new;
end $$;

create trigger jobs_log_insert
  after insert on jobs
  for each row execute function jobs_log_event();

create trigger jobs_log_update
  before update on jobs
  for each row execute function jobs_log_event();

-- -------------------------------------------------------------------- views
create view jobs_view as
select
  j.*,
  c.name                as company,
  c.blacklisted         as company_blacklisted,
  c.clearance_required  as company_clearance_required,
  case
    when j.application_deadline is null then null
    else j.application_deadline - current_date
  end                   as days_to_deadline,
  (j.status in ('saved') and j.application_deadline is not null
     and j.application_deadline < current_date) as deadline_passed
from jobs j
join companies c on c.id = j.company_id;

create view pipeline_summary as
select
  count(*)                                              as total,
  count(*) filter (where status = 'saved')              as saved,
  count(*) filter (where status = 'applied')            as applied,
  count(*) filter (where status = 'interview')          as interview,
  count(*) filter (where status = 'offer')              as offer,
  count(*) filter (where status = 'rejected')           as rejected,
  count(*) filter (where status in ('expired','withdrawn')) as closed,
  count(*) filter (where fit = 'High')                  as fit_high,
  count(*) filter (where fit = 'Medium-High')           as fit_medium_high,
  count(*) filter (where fit = 'Medium')                as fit_medium,
  count(*) filter (where fit = 'Low')                   as fit_low,
  count(*) filter (where status = 'saved'
                   and application_deadline between current_date and current_date + 7)
                                                        as due_this_week,
  count(*) filter (where follow_up_at is not null and follow_up_at <= current_date
                   and status in ('applied','interview'))
                                                        as follow_ups_due
from jobs;

-- Dedupe helper for the daily run: every company+role already known, from jobs and skips.
create view known_listings as
select lower(c.name) as company_key, lower(j.role) as role_key, 'job' as kind
from jobs j join companies c on c.id = j.company_id
union all
select lower(company_name), lower(role), 'skipped' from skipped_listings;

-- --------------------------------------------------------------------- rpc
-- Upsert a company by name and insert a job in one call. Used by the daily fetch.
create or replace function add_job(
  p_ref text,
  p_company text,
  p_role text,
  p_url text,
  p_fit fit_level,
  p_publication_date date,
  p_application_deadline date default null,
  p_location text default null,
  p_source text default null,
  p_contact_info text default null,
  p_notes text default null
) returns uuid language plpgsql as $$
declare
  v_company_id uuid;
  v_job_id uuid;
begin
  select id into v_company_id from companies where lower(name) = lower(p_company);
  if v_company_id is null then
    insert into companies (name) values (p_company) returning id into v_company_id;
  end if;

  if exists (select 1 from companies where id = v_company_id and blacklisted) then
    raise exception 'company % is blacklisted', p_company;
  end if;

  insert into jobs (ref, company_id, role, url, fit, publication_date, application_deadline,
                    location, source, contact_info, notes)
  values (p_ref, v_company_id, p_role, p_url, p_fit, p_publication_date, p_application_deadline,
          p_location, p_source, p_contact_info, p_notes)
  returning id into v_job_id;

  return v_job_id;
end $$;

-- Mark saved jobs whose deadline passed as expired. Call from the daily run.
create or replace function expire_stale_jobs() returns int language plpgsql as $$
declare v_count int;
begin
  update jobs set status = 'expired'
  where status = 'saved'
    and application_deadline is not null
    and application_deadline < current_date;
  get diagnostics v_count = row_count;
  return v_count;
end $$;

-- ---------------------------------------------------------------------- RLS
-- Single-user app without auth: anon has full access. Do not expose publicly.
alter table companies        enable row level security;
alter table jobs             enable row level security;
alter table job_events       enable row level security;
alter table contacts         enable row level security;
alter table skipped_listings enable row level security;
alter table daily_runs       enable row level security;

create policy anon_all on companies        for all to anon using (true) with check (true);
create policy anon_all on jobs             for all to anon using (true) with check (true);
create policy anon_all on job_events       for all to anon using (true) with check (true);
create policy anon_all on contacts         for all to anon using (true) with check (true);
create policy anon_all on skipped_listings for all to anon using (true) with check (true);
create policy anon_all on daily_runs       for all to anon using (true) with check (true);

-- ----------------------------------------------------------- hardening
-- Views run as the caller so RLS applies; functions pin search_path.
alter view jobs_view set (security_invoker = on);
alter view pipeline_summary set (security_invoker = on);
alter view known_listings set (security_invoker = on);

alter function jobs_touch_updated_at() set search_path = public;
alter function jobs_log_event() set search_path = public;
alter function add_job(text, text, text, text, fit_level, date, date, text, text, text, text) set search_path = public;
alter function expire_stale_jobs() set search_path = public;
