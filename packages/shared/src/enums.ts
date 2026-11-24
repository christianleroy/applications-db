export const STATUSES = ['applied', 'screening', 'interview', 'offer', 'accepted', 'rejected', 'ghosted', 'withdrawn'] as const;
export type Status = (typeof STATUSES)[number];

export const PROGRESS_STAGES = ['applied', 'screening', 'interview', 'offer', 'accepted'] as const;
export const ACTIVE_STATUSES = ['applied', 'screening', 'interview', 'offer'] as const;
export const TERMINAL_EXIT_STATUSES = ['rejected', 'ghosted', 'withdrawn'] as const;
export const NON_RESPONSE_STATUSES = ['applied', 'ghosted', 'withdrawn'] as const;

export const SOURCES = ['linkedin', 'indeed', 'company_site', 'referral', 'recruiter', 'job_board', 'other'] as const;
export type Source = (typeof SOURCES)[number];

export const WORK_MODES = ['onsite', 'hybrid', 'remote'] as const;
export type WorkMode = (typeof WORK_MODES)[number];

export const SALARY_PERIODS = ['year', 'month', 'hour'] as const;
export type SalaryPeriod = (typeof SALARY_PERIODS)[number];
