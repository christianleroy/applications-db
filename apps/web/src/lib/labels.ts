import type { DomainErrorCode, Source, Status, WorkMode } from '@applications-db/shared';

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

export const DOMAIN_ERROR_MESSAGES: Record<DomainErrorCode, string> = {
  ENTRY_NOT_FOUND: 'That status entry no longer exists.',
  FIRST_ENTRY_NOT_DELETABLE: "The first status entry can't be deleted.",
  FIRST_ENTRY_MUST_BE_APPLIED: 'The first status entry must be Applied.',
  ENTRY_BEFORE_APPLIED: "A status can't be dated before the application date.",
  NOT_FOUND: 'Application not found.',
};

export function isDomainErrorCode(code: string): code is DomainErrorCode {
  return Object.hasOwn(DOMAIN_ERROR_MESSAGES, code);
}
