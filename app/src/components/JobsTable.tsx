import { useMemo, useState } from 'react';
import type { Fit, JobRow, JobStatus } from '../lib/types';
import { FIT_ORDER, STATUS_ORDER, ACTIVE_STATUSES } from '../lib/types';
import { CATEGORIES, categorize, type Category } from '../lib/categorize';
import { CategoryTag, Chips, Deadline, FitBadge } from './ui';

type SortKey = 'fit' | 'role' | 'company' | 'date_added' | 'application_deadline' | 'status';

interface Props {
  jobs: JobRow[];
  onStatus: (job: JobRow, status: JobStatus) => void;
  onOpen: (job: JobRow) => void;
  onEdit: (job: JobRow) => void;
  onDelete: (job: JobRow) => void;
}

export function JobsTable({ jobs, onStatus, onOpen, onEdit, onDelete }: Props) {
  const [status, setStatus] = useState<JobStatus | 'all' | 'active'>('active');
  // An empty set means every fit is shown.
  const [fits, setFits] = useState<Set<Fit>>(new Set());
  const [category, setCategory] = useState<Category | 'all'>('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'fit', dir: 1 });

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = jobs.filter((j) => {
      if (status === 'active' && !ACTIVE_STATUSES.includes(j.status)) return false;
      if (status !== 'all' && status !== 'active' && j.status !== status) return false;
      if (fits.size > 0 && !fits.has(j.fit)) return false;
      if (category !== 'all' && categorize(j.role) !== category) return false;
      if (q) {
        const hay = `${j.ref} ${j.role} ${j.company} ${j.notes ?? ''} ${j.contact_info ?? ''} ${j.location ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    list.sort(comparator(sort.key, sort.dir));
    return list;
  }, [jobs, status, fits, category, search, sort]);

  function toggleFit(f: Fit) {
    setFits((prev) => {
      const next = new Set(prev);
      if (next.has(f)) next.delete(f);
      else next.add(f);
      return next;
    });
  }

  function toggleSort(key: SortKey) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: 1 }));
  }

  const th = (key: SortKey, label: string) => (
    <th className={`sortable ${sort.key === key ? 'sorted' : ''}`} onClick={() => toggleSort(key)}>
      {label} {sort.key === key ? (sort.dir === 1 ? '▲' : '▼') : ''}
    </th>
  );

  return (
    <>
      <div className="row">
        <div className="group">
          <span className="group-label">Status</span>
          <button className={`chip ${status === 'active' ? 'active' : ''}`} onClick={() => setStatus('active')}>
            Active
          </button>
          <button className={`chip ${status === 'all' ? 'active' : ''}`} onClick={() => setStatus('all')}>
            All
          </button>
          {STATUS_ORDER.map((s) => (
            <button key={s} className={`chip ${status === s ? 'active' : ''}`} onClick={() => setStatus(s)}>
              {s}
            </button>
          ))}
        </div>
        <div className="group">
          <span className="group-label">Fit</span>
          <button className={`chip ${fits.size === 0 ? 'active' : ''}`} onClick={() => setFits(new Set())}>
            All
          </button>
          {FIT_ORDER.map((f) => (
            <button key={f} className={`chip ${fits.has(f) ? 'active' : ''}`} onClick={() => toggleFit(f)}>
              {f}
            </button>
          ))}
        </div>
      </div>
      <div className="row">
        <Chips label="Category" value={category} options={CATEGORIES} onChange={setCategory} />
        <input
          type="text"
          placeholder="Search role / company / notes / ref…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 220 }}
        />
      </div>

      <p className="muted small">{visible.length} shown / {jobs.length} total</p>

      {visible.length === 0 ? (
        <div className="empty">No jobs match the current filters.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                {th('fit', 'Fit')}
                {th('role', 'Role')}
                {th('company', 'Company')}
                {th('status', 'Status')}
                {th('application_deadline', 'Deadline')}
                {th('date_added', 'Added')}
                <th>Follow-up</th>
                <th>Notes</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {visible.map((j) => (
                <tr key={j.id} className={ACTIVE_STATUSES.includes(j.status) ? '' : 'dim'}>
                  <td><FitBadge fit={j.fit} /></td>
                  <td className="role">
                    <CategoryTag role={j.role} />
                    <a href={j.url} target="_blank" rel="noopener noreferrer">{j.role}</a>
                    <div className="mono muted">{j.ref}{j.location ? ` · ${j.location}` : ''}</div>
                  </td>
                  <td>
                    {j.company}
                    {j.company_clearance_required && <span className="flag clearance">clearance</span>}
                  </td>
                  <td>
                    <select
                      className={`inline status ${j.status}`}
                      value={j.status}
                      onChange={(e) => onStatus(j, e.target.value as JobStatus)}
                    >
                      {STATUS_ORDER.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td><Deadline date={j.application_deadline} days={j.days_to_deadline} passed={j.deadline_passed} /></td>
                  <td className="nowrap muted small">{j.date_added}</td>
                  <td className="nowrap small">
                    {j.follow_up_at ? <FollowUp date={j.follow_up_at} /> : <span className="muted">—</span>}
                  </td>
                  <td className="notes">{j.notes}</td>
                  <td className="nowrap">
                    <button className="small" onClick={() => onOpen(j)}>Timeline</button>{' '}
                    <button className="small" onClick={() => onEdit(j)}>Edit</button>{' '}
                    <button className="small danger" onClick={() => onDelete(j)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function FollowUp({ date }: { date: string }) {
  const due = date <= new Date().toISOString().slice(0, 10);
  return <span className={due ? 'deadline urgent' : 'deadline ok'}>↻ {date}</span>;
}

function comparator(key: SortKey, dir: 1 | -1) {
  return (a: JobRow, b: JobRow): number => {
    if (key === 'fit') {
      const d = FIT_ORDER.indexOf(a.fit) - FIT_ORDER.indexOf(b.fit);
      return d !== 0 ? d * dir : b.date_added.localeCompare(a.date_added);
    }
    if (key === 'status') {
      const d = STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status);
      return d !== 0 ? d * dir : b.date_added.localeCompare(a.date_added);
    }
    if (key === 'application_deadline') {
      const av = a.application_deadline ?? '9999';
      const bv = b.application_deadline ?? '9999';
      return av.localeCompare(bv) * dir;
    }
    const av = (a[key] ?? '').toString().toLowerCase();
    const bv = (b[key] ?? '').toString().toLowerCase();
    return av.localeCompare(bv) * dir;
  };
}
