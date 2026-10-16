import { db } from './db';
import type {
  Company,
  Contact,
  DailyRun,
  Job,
  JobEvent,
  JobInput,
  JobRow,
  JobStatus,
  PipelineSummary,
  SkippedListing,
} from './types';

function unwrap<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

// ---------------------------------------------------------------- reads
export async function fetchJobs(): Promise<JobRow[]> {
  return unwrap(await db.from('jobs_view').select('*').order('date_added', { ascending: false }));
}

export async function fetchSummary(): Promise<PipelineSummary> {
  return unwrap(await db.from('pipeline_summary').select('*').single());
}

export async function fetchCompanies(): Promise<Company[]> {
  return unwrap(await db.from('companies').select('*').order('name'));
}

export async function fetchEvents(jobId: string): Promise<JobEvent[]> {
  return unwrap(
    await db.from('job_events').select('*').eq('job_id', jobId).order('occurred_at', { ascending: false }),
  );
}

export async function fetchContacts(companyId?: string): Promise<Contact[]> {
  let q = db.from('contacts').select('*').order('created_at', { ascending: false });
  if (companyId) q = q.eq('company_id', companyId);
  return unwrap(await q);
}

export async function fetchSkipped(): Promise<SkippedListing[]> {
  return unwrap(await db.from('skipped_listings').select('*').order('seen_on', { ascending: false }));
}

export async function fetchRuns(): Promise<DailyRun[]> {
  return unwrap(await db.from('daily_runs').select('*').order('run_date', { ascending: false }).limit(60));
}

// --------------------------------------------------------------- writes
export async function ensureCompany(name: string): Promise<Company> {
  const existing = unwrap(await db.from('companies').select('*').ilike('name', name).maybeSingle<Company>());
  if (existing) return existing;
  return unwrap(await db.from('companies').insert({ name }).select('*').single<Company>());
}

export async function createJob(input: JobInput): Promise<Job> {
  const company = await ensureCompany(input.company);
  const { company: _company, ...rest } = input;
  return unwrap(
    await db.from('jobs').insert({ ...rest, company_id: company.id }).select('*').single<Job>(),
  );
}

export async function updateJob(id: string, patch: Partial<Job>): Promise<Job> {
  return unwrap(await db.from('jobs').update(patch).eq('id', id).select('*').single<Job>());
}

export async function setStatus(id: string, status: JobStatus): Promise<Job> {
  return updateJob(id, { status });
}

export async function deleteJob(id: string): Promise<void> {
  unwrap(await db.from('jobs').delete().eq('id', id));
}

export async function addNote(jobId: string, note: string): Promise<JobEvent> {
  return unwrap(
    await db.from('job_events').insert({ job_id: jobId, type: 'note', note }).select('*').single<JobEvent>(),
  );
}

export async function updateCompany(id: string, patch: Partial<Company>): Promise<Company> {
  return unwrap(await db.from('companies').update(patch).eq('id', id).select('*').single<Company>());
}

export async function createCompany(name: string): Promise<Company> {
  return unwrap(await db.from('companies').insert({ name }).select('*').single<Company>());
}

export async function createContact(input: Omit<Contact, 'id' | 'created_at'>): Promise<Contact> {
  return unwrap(await db.from('contacts').insert(input).select('*').single<Contact>());
}

export async function deleteContact(id: string): Promise<void> {
  unwrap(await db.from('contacts').delete().eq('id', id));
}

export async function markSkippedReviewed(id: string, reviewed: boolean): Promise<void> {
  unwrap(await db.from('skipped_listings').update({ reviewed }).eq('id', id));
}

export async function deleteSkipped(id: string): Promise<void> {
  unwrap(await db.from('skipped_listings').delete().eq('id', id));
}

export async function expireStaleJobs(): Promise<number> {
  return unwrap(await db.rpc('expire_stale_jobs'));
}
