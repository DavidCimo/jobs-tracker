import type { Fit, JobStatus } from '../lib/types';
import { categorize } from '../lib/categorize';

export function FitBadge({ fit }: { fit: Fit }) {
  return <span className={`fit ${fit}`}>{fit}</span>;
}

export function StatusBadge({ status }: { status: JobStatus }) {
  return <span className={`status ${status}`}>{status}</span>;
}

export function CategoryTag({ role }: { role: string }) {
  const cat = categorize(role);
  return <span className={`cat cat-${cat}`}>{cat}</span>;
}

export function Deadline({ date, days, passed }: { date: string | null; days: number | null; passed?: boolean }) {
  if (!date || days === null) return <span className="muted small">—</span>;
  let cls = 'ok';
  let label = `${date}`;
  if (passed || days < 0) {
    cls = 'passed';
  } else if (days <= 3) {
    cls = 'urgent';
    label = `${date} · ${days}d`;
  } else if (days <= 10) {
    cls = 'soon';
    label = `${date} · ${days}d`;
  } else {
    label = `${date} · ${days}d`;
  }
  return <span className={`deadline ${cls}`} title="Application deadline">{label}</span>;
}

export function Chips<T extends string>({
  label,
  value,
  options,
  onChange,
  render,
}: {
  label: string;
  value: T | 'all';
  options: readonly T[];
  onChange: (v: T | 'all') => void;
  render?: (v: T) => string;
}) {
  return (
    <div className="group">
      <span className="group-label">{label}</span>
      <button className={`chip ${value === 'all' ? 'active' : ''}`} onClick={() => onChange('all')}>
        All
      </button>
      {options.map((o) => (
        <button key={o} className={`chip ${value === o ? 'active' : ''}`} onClick={() => onChange(o)}>
          {render ? render(o) : o}
        </button>
      ))}
    </div>
  );
}

export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function fmtDateTime(iso: string): string {
  return iso.slice(0, 16).replace('T', ' ');
}
