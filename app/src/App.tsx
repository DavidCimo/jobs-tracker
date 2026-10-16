import { useCallback, useEffect, useState } from 'react';
import type { Company, Contact, DailyRun, JobInput, JobRow, JobStatus, PipelineSummary, SkippedListing } from './lib/types';
import { dbConfigHint, dbConfigured } from './lib/db';
import {
  createJob, deleteJob, expireStaleJobs, fetchCompanies, fetchContacts, fetchJobs, fetchRuns, fetchSkipped,
  fetchSummary, setStatus, updateJob,
} from './lib/api';
import { JobsTable } from './components/JobsTable';
import { JobDialog } from './components/JobDialog';
import { JobDrawer } from './components/JobDrawer';
import { Deadlines } from './components/Deadlines';
import { Companies } from './components/Companies';
import { Skipped } from './components/Skipped';
import { Runs } from './components/Runs';

type Tab = 'jobs' | 'today' | 'companies' | 'skipped' | 'runs';

export default function App() {
  const [tab, setTab] = useState<Tab>('today');
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [summary, setSummary] = useState<PipelineSummary | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [skipped, setSkipped] = useState<SkippedListing[]>([]);
  const [runs, setRuns] = useState<DailyRun[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState<{ open: boolean; job: JobRow | null }>({ open: false, job: null });
  const [drawer, setDrawer] = useState<JobRow | null>(null);

  const reload = useCallback(async () => {
    if (!dbConfigured) {
      setError(dbConfigHint);
      setLoading(false);
      return;
    }
    try {
      const [j, s, c, k, sk, r] = await Promise.all([
        fetchJobs(), fetchSummary(), fetchCompanies(), fetchContacts(), fetchSkipped(), fetchRuns(),
      ]);
      setJobs(j); setSummary(s); setCompanies(c); setContacts(k); setSkipped(sk); setRuns(r);
      setError(null);
      if (drawer) setDrawer(j.find((x) => x.id === drawer.id) ?? null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [drawer]);

  useEffect(() => { void reload(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function guard(fn: () => Promise<unknown>) {
    try {
      await fn();
      await reload();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const onStatus = (job: JobRow, status: JobStatus) => guard(() => setStatus(job.id, status));
  const onDelete = (job: JobRow) => {
    if (window.confirm(`Delete "${job.role}" at ${job.company}? This also removes its timeline.`)) void guard(() => deleteJob(job.id));
  };
  const onSave = async (input: JobInput, id?: string) => {
    if (id) {
      const { company: _c, company_id: _cid, ...patch } = input;
      await updateJob(id, patch);
    } else {
      await createJob(input);
    }
    await reload();
  };
  const onExpire = () => guard(async () => {
    const n = await expireStaleJobs();
    window.alert(`${n} saved job(s) with a passed deadline moved to expired.`);
  });

  const activeCount = jobs.filter((j) => ['saved', 'applied', 'interview', 'offer'].includes(j.status)).length;
  const unreviewedSkips = skipped.filter((s) => !s.reviewed).length;

  return (
    <>
      <header>
        <h1>
          Jobs Tracker
          {import.meta.env.VITE_APP_TAGLINE && <small>{import.meta.env.VITE_APP_TAGLINE}</small>}
          <span className="spacer" />
          <button className="small" onClick={() => void reload()} disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</button>
          <button className="small" onClick={onExpire} title="Move saved jobs with a passed deadline to expired">Expire stale</button>
          <button className="small primary" onClick={() => setDialog({ open: true, job: null })}>+ Add job</button>
        </h1>
        <nav className="tabs">
          <TabBtn id="today" cur={tab} set={setTab} label="Today" count={summary ? summary.due_this_week + summary.follow_ups_due : undefined} />
          <TabBtn id="jobs" cur={tab} set={setTab} label="Jobs" count={activeCount} />
          <TabBtn id="companies" cur={tab} set={setTab} label="Companies" count={companies.length} />
          <TabBtn id="skipped" cur={tab} set={setTab} label="Skipped" count={unreviewedSkips} />
          <TabBtn id="runs" cur={tab} set={setTab} label="Daily runs" count={runs.length} />
        </nav>
      </header>

      <main>
        {error && <div className="error">{error}</div>}

        {summary && (
          <div className="stats">
            <Stat label="Active" value={summary.saved + summary.applied + summary.interview + summary.offer} />
            <Stat label="Saved" value={summary.saved} />
            <Stat label="Applied" value={summary.applied} cls="good" />
            <Stat label="Interview" value={summary.interview} cls="good" />
            <Stat label="Offer" value={summary.offer} cls="good" />
            <Stat label="Rejected" value={summary.rejected} />
            <Stat label="Due ≤ 7d" value={summary.due_this_week} cls={summary.due_this_week > 0 ? 'warn' : ''} />
            <Stat label="Follow-ups due" value={summary.follow_ups_due} cls={summary.follow_ups_due > 0 ? 'bad' : ''} />
            <Stat label="High fit" value={summary.fit_high} />
          </div>
        )}

        {tab === 'today' && <Deadlines jobs={jobs} onOpen={setDrawer} />}
        {tab === 'jobs' && (
          <JobsTable
            jobs={jobs}
            onStatus={onStatus}
            onOpen={setDrawer}
            onEdit={(j) => setDialog({ open: true, job: j })}
            onDelete={onDelete}
          />
        )}
        {tab === 'companies' && <Companies companies={companies} contacts={contacts} jobs={jobs} onChanged={() => void reload()} />}
        {tab === 'skipped' && <Skipped skipped={skipped} onChanged={() => void reload()} />}
        {tab === 'runs' && <Runs runs={runs} />}
      </main>

      <JobDialog open={dialog.open} job={dialog.job} onClose={() => setDialog({ open: false, job: null })} onSave={onSave} />
      {drawer && <JobDrawer job={drawer} onClose={() => setDrawer(null)} onChanged={() => void reload()} />}
    </>
  );
}

function TabBtn({ id, cur, set, label, count }: { id: Tab; cur: Tab; set: (t: Tab) => void; label: string; count?: number }) {
  return (
    <button className={`tab ${cur === id ? 'active' : ''}`} onClick={() => set(id)}>
      {label}{count !== undefined && <span className="count">{count}</span>}
    </button>
  );
}

function Stat({ label, value, cls = '' }: { label: string; value: number; cls?: string }) {
  return (
    <div className={`stat ${cls}`}>
      <div className="label">{label}</div>
      <div className="value">{value}</div>
    </div>
  );
}
