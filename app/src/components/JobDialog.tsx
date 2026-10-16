import { useEffect, useRef, useState } from 'react';
import type { Fit, JobInput, JobRow, JobStatus } from '../lib/types';
import { FIT_ORDER, STATUS_ORDER } from '../lib/types';
import { todayISO } from './ui';

interface Props {
  open: boolean;
  job: JobRow | null; // null = create
  onClose: () => void;
  onSave: (input: JobInput, id?: string) => Promise<void>;
}

const empty = (): JobInput => ({
  ref: '',
  company: '',
  company_id: '',
  role: '',
  url: '',
  location: import.meta.env.VITE_DEFAULT_LOCATION ?? '',
  source: 'manual',
  fit: 'Medium',
  status: 'saved',
  date_added: todayISO(),
  publication_date: null,
  application_deadline: null,
  follow_up_at: null,
  contact_info: '',
  notes: '',
});

export function JobDialog({ open, job, onClose, onSave }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [form, setForm] = useState<JobInput>(empty());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm(job ? { ...job, company: job.company } : empty());
      setError(null);
      ref.current?.showModal();
    } else {
      ref.current?.close();
    }
  }, [open, job]);

  const set = <K extends keyof JobInput>(k: K, v: JobInput[K]) => setForm((f) => ({ ...f, [k]: v }));
  const str = (v: string) => (v.trim() === '' ? null : v);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.ref || !form.role || !form.company || !form.url.startsWith('https://')) {
      setError('Ref, role, company and an https:// URL are required.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSave(form, job?.id);
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <dialog ref={ref} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="dlg-head">
          <strong>{job ? `Edit ${job.ref}` : 'Add job'}</strong>
          <button type="button" className="ghost" onClick={onClose}>✕</button>
        </div>
        <div className="dlg-body">
          <label>Ref *</label>
          <input type="text" value={form.ref} onChange={(e) => set('ref', e.target.value.toUpperCase())} placeholder="ACME-001" disabled={!!job} />
          <label>Role *</label>
          <input type="text" value={form.role} onChange={(e) => set('role', e.target.value)} />
          <label>Company *</label>
          <input type="text" value={form.company} onChange={(e) => set('company', e.target.value)} disabled={!!job} />
          <label>URL *</label>
          <input type="url" value={form.url} onChange={(e) => set('url', e.target.value)} placeholder="https://…" />
          <label>Location</label>
          <input type="text" value={form.location ?? ''} onChange={(e) => set('location', str(e.target.value))} />
          <label>Source</label>
          <input type="text" value={form.source ?? ''} onChange={(e) => set('source', str(e.target.value))} placeholder="webbjobb.io, linkedin…" />
          <label>Fit</label>
          <select value={form.fit} onChange={(e) => set('fit', e.target.value as Fit)}>
            {FIT_ORDER.map((f) => <option key={f}>{f}</option>)}
          </select>
          <label>Status</label>
          <select value={form.status} onChange={(e) => set('status', e.target.value as JobStatus)}>
            {STATUS_ORDER.map((s) => <option key={s}>{s}</option>)}
          </select>
          <label>Published</label>
          <input type="date" value={form.publication_date ?? ''} onChange={(e) => set('publication_date', str(e.target.value))} />
          <label>Deadline</label>
          <input type="date" value={form.application_deadline ?? ''} onChange={(e) => set('application_deadline', str(e.target.value))} />
          <label>Follow-up</label>
          <input type="date" value={form.follow_up_at ?? ''} onChange={(e) => set('follow_up_at', str(e.target.value))} />
          <label>Contact</label>
          <input type="text" value={form.contact_info ?? ''} onChange={(e) => set('contact_info', str(e.target.value))} placeholder="recruiter email / phone" />
          <label>Notes</label>
          <textarea value={form.notes ?? ''} onChange={(e) => set('notes', str(e.target.value))} />
          {error && <div className="error full">{error}</div>}
        </div>
        <div className="dlg-foot">
          <button type="button" onClick={onClose}>Cancel</button>
          <button type="submit" className="primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </dialog>
  );
}
