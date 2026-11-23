import type { Source, Status, WorkMode } from '@applications-db/shared';

export const STATUS_LABELS: Record<Status, string> = {
  applied: 'Applied',
  screening: 'Screening',
  interview: 'Interview',
  offer: 'Offer',
  accepted: 'Accepted',
  rejected: 'Rejected',
  ghosted: 'Ghosted',
  withdrawn: 'Withdrawn',
};

export const SOURCE_LABELS: Record<Source, string> = {
  linkedin: 'LinkedIn',
  indeed: 'Indeed',
  company_site: 'Company site',
  referral: 'Referral',
  recruiter: 'Recruiter',
  job_board: 'Job board',
  other: 'Other',
};

export const WORK_MODE_LABELS: Record<WorkMode, string> = {
  onsite: 'On-site',
  hybrid: 'Hybrid',
  remote: 'Remote',
};
