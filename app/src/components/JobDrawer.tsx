import { useEffect, useState } from 'react';
import type { Contact, JobEvent, JobRow } from '../lib/types';
import { addNote, createContact, deleteContact, fetchContacts, fetchEvents, updateJob } from '../lib/api';
import { Deadline, FitBadge, StatusBadge, fmtDateTime } from './ui';

interface Props {
  job: JobRow;
  onClose: () => void;
  onChanged: () => void;
}

export function JobDrawer({ job, onClose, onChanged }: Props) {
  const [events, setEvents] = useState<JobEvent[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [note, setNote] = useState('');
  const [followUp, setFollowUp] = useState(job.follow_up_at ?? '');
  const [newContact, setNewContact] = useState({ name: '', title: '', email: '', phone: '' });
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    try {
      const [ev, ct] = await Promise.all([fetchEvents(job.id), fetchContacts(job.company_id)]);
      setEvents(ev);
      setContacts(ct);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => { void reload(); }, [job.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function submitNote() {
    if (!note.trim()) return;
    await addNote(job.id, note.trim());
    setNote('');
    await reload();
  }

  async function saveFollowUp() {
    await updateJob(job.id, { follow_up_at: followUp || null });
    if (followUp) await addNote(job.id, `Follow-up set for ${followUp}`);
    onChanged();
    await reload();
  }

  async function submitContact() {
    if (!newContact.name.trim()) return;
    await createContact({
      company_id: job.company_id,
      job_id: job.id,
      name: newContact.name.trim(),
      title: newContact.title || null,
      email: newContact.email || null,
      phone: newContact.phone || null,
      linkedin: null,
      notes: null,
    });
    setNewContact({ name: '', title: '', email: '', phone: '' });
    await reload();
  }

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <aside className="drawer">
        <div className="row">
          <h3 style={{ flex: 1 }}>{job.role}</h3>
          <button className="ghost" onClick={onClose}>✕</button>
        </div>
        <div className="row">
          <FitBadge fit={job.fit} />
          <StatusBadge status={job.status} />
          <span className="mono muted">{job.ref}</span>
        </div>
        {error && <div className="error">{error}</div>}

        <dl className="kv">
          <dt>Company</dt><dd>{job.company}</dd>
          <dt>Listing</dt><dd><a href={job.url} target="_blank" rel="noopener noreferrer">{new URL(job.url).host}</a></dd>
          <dt>Location</dt><dd>{job.location ?? '—'}</dd>
          <dt>Published</dt><dd>{job.publication_date ?? '—'}</dd>
          <dt>Deadline</dt><dd><Deadline date={job.application_deadline} days={job.days_to_deadline} passed={job.deadline_passed} /></dd>
          <dt>Applied</dt><dd>{job.applied_at ?? '—'}</dd>
          <dt>Contact</dt><dd>{job.contact_info ?? '—'}</dd>
          <dt>Notes</dt><dd className="muted">{job.notes ?? '—'}</dd>
        </dl>

        <h2>Follow-up</h2>
        <div className="row">
          <input type="date" value={followUp} onChange={(e) => setFollowUp(e.target.value)} />
          <button className="small" onClick={saveFollowUp}>Save</button>
          {job.follow_up_at && (
            <button className="small ghost" onClick={() => { setFollowUp(''); void updateJob(job.id, { follow_up_at: null }).then(onChanged); }}>
              Clear
            </button>
          )}
        </div>

        <h2>Add note</h2>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Called recruiter, sent CV v3, interview booked…" />
        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 6 }}>
          <button className="small primary" onClick={submitNote} disabled={!note.trim()}>Add</button>
        </div>

        <h2>Contacts at {job.company}</h2>
        {contacts.length === 0 && <p className="muted small">None yet.</p>}
        <ul className="timeline">
          {contacts.map((c) => (
            <li key={c.id}>
              <strong>{c.name}</strong>{c.title ? <span className="muted"> · {c.title}</span> : null}
              <div className="small">
                {c.email && <a href={`mailto:${c.email}`}>{c.email}</a>}
                {c.email && c.phone ? ' · ' : ''}
                {c.phone}
              </div>
              <button className="small ghost danger" onClick={() => deleteContact(c.id).then(reload)}>remove</button>
            </li>
          ))}
        </ul>
        <div className="row" style={{ marginTop: 6 }}>
          <input type="text" placeholder="Name" value={newContact.name} onChange={(e) => setNewContact({ ...newContact, name: e.target.value })} style={{ width: 130 }} />
          <input type="text" placeholder="Title" value={newContact.title} onChange={(e) => setNewContact({ ...newContact, title: e.target.value })} style={{ width: 120 }} />
          <input type="email" placeholder="Email" value={newContact.email} onChange={(e) => setNewContact({ ...newContact, email: e.target.value })} style={{ width: 160 }} />
          <input type="text" placeholder="Phone" value={newContact.phone} onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })} style={{ width: 110 }} />
          <button className="small" onClick={submitContact} disabled={!newContact.name.trim()}>Add</button>
        </div>

        <h2>Timeline</h2>
        <ul className="timeline">
          {events.map((ev) => (
            <li key={ev.id}>
              <div className="when">{fmtDateTime(ev.occurred_at)}</div>
              {ev.type === 'status_change' && (
                <span><StatusBadge status={ev.from_status!} /> → <StatusBadge status={ev.to_status!} /></span>
              )}
              {ev.type === 'created' && <span>Created · {ev.note}</span>}
              {ev.type === 'deadline_change' && <span>Deadline {ev.note}</span>}
              {(ev.type === 'note' || ev.type === 'follow_up' || ev.type === 'contact') && <span>{ev.note}</span>}
            </li>
          ))}
        </ul>
      </aside>
    </>
  );
}
