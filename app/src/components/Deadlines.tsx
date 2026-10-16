import type { JobRow } from '../lib/types';
import { CategoryTag, Deadline, FitBadge, StatusBadge, todayISO } from './ui';

interface Props {
  jobs: JobRow[];
  onOpen: (job: JobRow) => void;
}

/** Action view: what needs doing this week. */
export function Deadlines({ jobs, onOpen }: Props) {
  const today = todayISO();

  const followUps = jobs
    .filter((j) => j.follow_up_at && ['applied', 'interview', 'offer'].includes(j.status))
    .sort((a, b) => a.follow_up_at!.localeCompare(b.follow_up_at!));

  const toApply = jobs
    .filter((j) => j.status === 'saved' && !j.deadline_passed)
    .sort((a, b) => (a.application_deadline ?? '9999').localeCompare(b.application_deadline ?? '9999'));

  const passed = jobs.filter((j) => j.status === 'saved' && j.deadline_passed);

  const inProgress = jobs
    .filter((j) => ['applied', 'interview', 'offer'].includes(j.status))
    .sort((a, b) => (b.applied_at ?? b.date_added).localeCompare(a.applied_at ?? a.date_added));

  const Row = ({ j, extra }: { j: JobRow; extra?: React.ReactNode }) => (
    <tr key={j.id} className="clickable" onClick={() => onOpen(j)}>
      <td><FitBadge fit={j.fit} /></td>
      <td className="role"><CategoryTag role={j.role} />{j.role}</td>
      <td>{j.company}</td>
      <td><StatusBadge status={j.status} /></td>
      <td>{extra}</td>
    </tr>
  );

  const Table = ({ rows, col }: { rows: React.ReactNode; col: string }) => (
    <table>
      <thead><tr><th>Fit</th><th>Role</th><th>Company</th><th>Status</th><th>{col}</th></tr></thead>
      <tbody>{rows}</tbody>
    </table>
  );

  return (
    <>
      <h2>Follow-ups {followUps.length > 0 && `(${followUps.filter((j) => j.follow_up_at! <= today).length} due)`}</h2>
      {followUps.length === 0 ? <p className="muted small">No follow-ups scheduled. Set one from a job's timeline after applying.</p> : (
        <Table col="Follow-up" rows={followUps.map((j) => (
          <Row key={j.id} j={j} extra={<span className={`deadline ${j.follow_up_at! <= today ? 'urgent' : 'ok'}`}>↻ {j.follow_up_at}</span>} />
        ))} />
      )}

      <h2>To apply, by deadline ({toApply.length})</h2>
      {toApply.length === 0 ? <p className="muted small">Nothing saved and open.</p> : (
        <Table col="Deadline" rows={toApply.map((j) => (
          <Row key={j.id} j={j} extra={<Deadline date={j.application_deadline} days={j.days_to_deadline} />} />
        ))} />
      )}

      <h2>In progress ({inProgress.length})</h2>
      {inProgress.length === 0 ? <p className="muted small">No open applications.</p> : (
        <Table col="Applied" rows={inProgress.map((j) => (
          <Row key={j.id} j={j} extra={<span className="muted small">{j.applied_at ?? '—'}</span>} />
        ))} />
      )}

      {passed.length > 0 && (
        <>
          <h2>Saved but deadline passed ({passed.length})</h2>
          <p className="muted small">Use "Expire stale" in the header to move these to expired.</p>
          <Table col="Deadline" rows={passed.map((j) => (
            <Row key={j.id} j={j} extra={<Deadline date={j.application_deadline} days={j.days_to_deadline} passed />} />
          ))} />
        </>
      )}
    </>
  );
}
