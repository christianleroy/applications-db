import type { Source, Status } from '@applications-db/shared';

/**
 * One muted palette per status, shared by StatusBadge and the charts so a status is the same
 * colour everywhere. `hex` is the Tailwind 600-ish shade used for chart marks; `badgeClass`
 * styles the badge. None of these is the maroon site primary (#7B1E2E).
 */
export const STATUS_COLORS: Record<Status, { hex: string; badgeClass: string }> = {
  applied: { hex: '#64748b', badgeClass: 'border-slate-200 bg-slate-50 text-slate-700' },
  screening: { hex: '#0ea5e9', badgeClass: 'border-sky-200 bg-sky-50 text-sky-800' },
  interview: { hex: '#d97706', badgeClass: 'border-amber-200 bg-amber-50 text-amber-800' },
  offer: { hex: '#059669', badgeClass: 'border-emerald-200 bg-emerald-50 text-emerald-800' },
  accepted: { hex: '#16a34a', badgeClass: 'border-green-300 bg-green-100 text-green-900' },
  rejected: { hex: '#f43f5e', badgeClass: 'border-rose-200 bg-rose-50 text-rose-700' },
  ghosted: { hex: '#a8a29e', badgeClass: 'border-stone-200 bg-stone-100 text-stone-600' },
  withdrawn: { hex: '#52525b', badgeClass: 'border-zinc-300 bg-zinc-100 text-zinc-700' },
};

/** Muted categorical palette for source series; separate from the status colours and the site maroon. */
export const SOURCE_COLORS: Record<Source, string> = {
  linkedin: '#4e79a7',
  indeed: '#59a14f',
  company_site: '#edc948',
  referral: '#b07aa1',
  recruiter: '#76b7b2',
  job_board: '#f28e2b',
  other: '#9c9c9c',
};

/** Neutral grey for the Sankey "No response yet" node. */
export const NO_RESPONSE_COLOR = '#d4d4d4';
