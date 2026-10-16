export type Fit = 'High' | 'Medium-High' | 'Medium' | 'Low';
export const FIT_ORDER: Fit[] = ['High', 'Medium-High', 'Medium', 'Low'];

export type JobStatus =
  | 'saved'
  | 'applied'
  | 'interview'
  | 'offer'
  | 'rejected'
  | 'expired'
  | 'withdrawn';
export const STATUS_ORDER: JobStatus[] = [
  'saved',
  'applied',
  'interview',
  'offer',
  'rejected',
  'expired',
  'withdrawn',
];
export const ACTIVE_STATUSES: JobStatus[] = ['saved', 'applied', 'interview', 'offer'];

export type SkipReason =
  | 'clearance'
  | 'senior_5plus'
  | 'outside_window'
  | 'outside_location'
  | 'blacklisted'
  | 'unverifiable_date'
  | 'low_fit';

export type EventType =
  | 'created'
  | 'status_change'
  | 'note'
  | 'follow_up'
  | 'contact'
  | 'deadline_change';

export interface Company {
  id: string;
  name: string;
  website: string | null;
  blacklisted: boolean;
  blacklist_reason: string | null;
  clearance_required: boolean;
  notes: string | null;
  created_at: string;
}

export interface Job {
  id: string;
  ref: string;
  company_id: string;
  role: string;
  url: string;
  location: string | null;
  source: string | null;
  fit: Fit;
  status: JobStatus;
  date_added: string;
  publication_date: string | null;
  application_deadline: string | null;
  applied_at: string | null;
  follow_up_at: string | null;
  contact_info: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/** Row from the jobs_view SQL view: job + company fields. */
export interface JobRow extends Job {
  company: string;
  company_blacklisted: boolean;
  company_clearance_required: boolean;
  days_to_deadline: number | null;
  deadline_passed: boolean;
}

export interface JobEvent {
  id: string;
  job_id: string;
  type: EventType;
  from_status: JobStatus | null;
  to_status: JobStatus | null;
  note: string | null;
  occurred_at: string;
}

export interface Contact {
  id: string;
  company_id: string | null;
  job_id: string | null;
  name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  linkedin: string | null;
  notes: string | null;
  created_at: string;
}

export interface SkippedListing {
  id: string;
  company_name: string;
  role: string;
  url: string | null;
  reason: SkipReason;
  note: string | null;
  publication_date: string | null;
  seen_on: string;
  reviewed: boolean;
  created_at: string;
}

export interface DailyRun {
  id: string;
  run_date: string;
  sources: string[];
  browser_used: boolean;
  cascade_rung: string | null;
  added_count: number;
  skipped_count: number;
  brief_md: string | null;
  observations: string | null;
  created_at: string;
}

export interface PipelineSummary {
  total: number;
  saved: number;
  applied: number;
  interview: number;
  offer: number;
  rejected: number;
  closed: number;
  fit_high: number;
  fit_medium_high: number;
  fit_medium: number;
  fit_low: number;
  due_this_week: number;
  follow_ups_due: number;
}

export type JobInput = Omit<Job, 'id' | 'created_at' | 'updated_at' | 'applied_at'> & {
  company: string;
};
