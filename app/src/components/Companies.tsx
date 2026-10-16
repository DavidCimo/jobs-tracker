import { useState } from 'react';
import type { Company, Contact, JobRow } from '../lib/types';
import { createCompany, deleteContact, updateCompany } from '../lib/api';

interface Props {
  companies: Company[];
  contacts: Contact[];
  jobs: JobRow[];
  onChanged: () => void;
}

export function Companies({ companies, contacts, jobs, onChanged }: Props) {
  const [filter, setFilter] = useState<'all' | 'blacklisted' | 'clearance'>('all');
  const [newName, setNewName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const visible = companies.filter((c) => {
    if (filter === 'blacklisted') return c.blacklisted;
    if (filter === 'clearance') return c.clearance_required;
    return true;
  });

  async function run(fn: () => Promise<unknown>) {
    try {
      setError(null);
      await fn();
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function toggleBlacklist(c: Company) {
    if (c.blacklisted) {
      return run(() => updateCompany(c.id, { blacklisted: false, blacklist_reason: null }));
    }
    const reason = window.prompt(`Blacklist ${c.name}. Reason?`, 'fake / spam listings');
    if (reason === null) return;
    return run(() => updateCompany(c.id, { blacklisted: true, blacklist_reason: reason }));
  }

  return (
    <>
      {error && <div className="error">{error}</div>}
      <div className="row">
        <div className="group">
          <span className="group-label">Show</span>
          {(['all', 'blacklisted', 'clearance'] as const).map((f) => (
            <button key={f} className={`chip ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>{f}</button>
          ))}
        </div>
        <span className="spacer" />
        <input type="text" placeholder="New company name" value={newName} onChange={(e) => setNewName(e.target.value)} />
        <button
          className="primary"
          disabled={!newName.trim()}
          onClick={() => run(() => createCompany(newName.trim())).then(() => setNewName(''))}
        >
          + Add
        </button>
      </div>
      <p className="muted small">
        Blacklisted companies are skipped by the daily run and rejected by the add_job function.
        Clearance-required companies are shown with a flag but still tracked.
      </p>
      <table>
        <thead>
          <tr><th>Company</th><th>Jobs</th><th>Flags</th><th>Contacts</th><th>Notes</th><th></th></tr>
        </thead>
        <tbody>
          {visible.map((c) => {
            const cj = jobs.filter((j) => j.company_id === c.id);
            const cc = contacts.filter((k) => k.company_id === c.id);
            return (
              <tr key={c.id} className={c.blacklisted ? 'dim' : ''}>
                <td>
                  <strong>{c.name}</strong>
                  {c.website && <div className="small"><a href={c.website} target="_blank" rel="noopener noreferrer">{c.website}</a></div>}
                </td>
                <td className="small">
                  {cj.length === 0 ? <span className="muted">—</span> : cj.map((j) => (
                    <div key={j.id}><span className={`status ${j.status}`}>{j.status}</span> {j.role}</div>
                  ))}
                </td>
                <td>
                  {c.blacklisted && <span className="flag black" title={c.blacklist_reason ?? ''}>blacklisted</span>}
                  {c.clearance_required && <span className="flag clearance">clearance</span>}
                  {c.blacklisted && c.blacklist_reason && <div className="muted small">{c.blacklist_reason}</div>}
                </td>
                <td className="small">
                  {cc.length === 0 ? <span className="muted">—</span> : cc.map((k) => (
                    <div key={k.id}>
                      <strong>{k.name}</strong>{k.title ? ` · ${k.title}` : ''}
                      {k.email && <> · <a href={`mailto:${k.email}`}>{k.email}</a></>}
                      {k.phone && <> · {k.phone}</>}
                      {' '}<button className="small ghost danger" onClick={() => run(() => deleteContact(k.id))}>×</button>
                    </div>
                  ))}
                </td>
                <td className="notes">{c.notes}</td>
                <td className="nowrap">
                  <button className="small" onClick={() => toggleBlacklist(c)}>
                    {c.blacklisted ? 'Unblacklist' : 'Blacklist'}
                  </button>{' '}
                  <button className="small" onClick={() => run(() => updateCompany(c.id, { clearance_required: !c.clearance_required }))}>
                    {c.clearance_required ? 'No clearance' : 'Clearance'}
                  </button>{' '}
                  <button
                    className="small"
                    onClick={() => {
                      const notes = window.prompt(`Notes for ${c.name}`, c.notes ?? '');
                      if (notes !== null) void run(() => updateCompany(c.id, { notes: notes || null }));
                    }}
                  >
                    Notes
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
}
