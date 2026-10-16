import { useState } from 'react';
import type { SkipReason, SkippedListing } from '../lib/types';
import { deleteSkipped, markSkippedReviewed } from '../lib/api';

const REASONS: SkipReason[] = [
  'clearance', 'senior_5plus', 'low_fit', 'outside_window', 'outside_location', 'unverifiable_date', 'blacklisted',
];

interface Props {
  skipped: SkippedListing[];
  onChanged: () => void;
}

/** Listings the daily run saw and did not add. For manual review. */
export function Skipped({ skipped, onChanged }: Props) {
  const [reason, setReason] = useState<SkipReason | 'all'>('all');
  const [showReviewed, setShowReviewed] = useState(false);

  const visible = skipped.filter((s) => {
    if (!showReviewed && s.reviewed) return false;
    if (reason !== 'all' && s.reason !== reason) return false;
    return true;
  });

  return (
    <>
      <div className="row">
        <div className="group">
          <span className="group-label">Reason</span>
          <button className={`chip ${reason === 'all' ? 'active' : ''}`} onClick={() => setReason('all')}>All</button>
          {REASONS.map((r) => (
            <button key={r} className={`chip ${reason === r ? 'active' : ''}`} onClick={() => setReason(r)}>
              {r.replace('_', ' ')} <span className="muted">{skipped.filter((s) => s.reason === r && (showReviewed || !s.reviewed)).length}</span>
            </button>
          ))}
        </div>
        <span className="spacer" />
        <label className="small muted">
          <input type="checkbox" checked={showReviewed} onChange={(e) => setShowReviewed(e.target.checked)} /> show reviewed
        </label>
      </div>
      <p className="muted small">
        Mark a row reviewed once you've looked at it. Delete a row to let the daily run pick the listing up again.
      </p>
      {visible.length === 0 ? <div className="empty">Nothing to review.</div> : (
        <table>
          <thead>
            <tr><th>Seen</th><th>Company</th><th>Role</th><th>Reason</th><th>Note</th><th></th></tr>
          </thead>
          <tbody>
            {visible.map((s) => (
              <tr key={s.id} className={s.reviewed ? 'dim' : ''}>
                <td className="nowrap muted small">{s.seen_on}</td>
                <td>{s.company_name}</td>
                <td className="role">
                  {s.url ? <a href={s.url} target="_blank" rel="noopener noreferrer">{s.role}</a> : s.role}
                  {s.publication_date && <div className="muted small">published {s.publication_date}</div>}
                </td>
                <td><span className="flag clearance">{s.reason.replace('_', ' ')}</span></td>
                <td className="notes">{s.note}</td>
                <td className="nowrap">
                  <button className="small" onClick={() => markSkippedReviewed(s.id, !s.reviewed).then(onChanged)}>
                    {s.reviewed ? 'Unreview' : 'Reviewed'}
                  </button>{' '}
                  <button className="small danger" onClick={() => deleteSkipped(s.id).then(onChanged)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
