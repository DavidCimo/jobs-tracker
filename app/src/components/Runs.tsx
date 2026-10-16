import type { DailyRun } from '../lib/types';

/** Daily fetch history. One row per run, brief markdown expandable. */
export function Runs({ runs }: { runs: DailyRun[] }) {
  if (runs.length === 0) {
    return <div className="empty">No daily runs recorded yet. The fetch skill writes one row per day into daily_runs.</div>;
  }
  return (
    <>
      {runs.map((r) => (
        <details key={r.id} className="brief">
          <summary>
            <strong>{r.run_date}</strong>
            <span className="muted"> · added {r.added_count} · skipped {r.skipped_count}</span>
            {r.cascade_rung && <span className="muted"> · {r.cascade_rung}</span>}
            {r.browser_used && <span className="flag clearance">browser</span>}
          </summary>
          <div className="muted small" style={{ marginTop: 6 }}>Sources: {r.sources.join(', ') || '—'}</div>
          {r.observations && <p className="small">{r.observations}</p>}
          {r.brief_md && <pre>{r.brief_md}</pre>}
        </details>
      ))}
    </>
  );
}
