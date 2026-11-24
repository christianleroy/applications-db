import type { Application, ApplicationQuery, Page, SortKey } from './schemas';

const normalize = (s: string): string =>
  s.toLocaleLowerCase().normalize('NFD').replace(/\p{M}/gu, '');

const searchableText = (a: Application): string[] => [
  a.company,
  a.role,
  a.notes ?? '',
  a.location ?? '',
  ...a.contacts.flatMap((c) => [c.name, c.role ?? '', c.email ?? '', c.phone ?? '', c.notes ?? '']),
];

const byId = (a: Application, b: Application): number => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

const comparators: Record<SortKey, (a: Application, b: Application) => number> = {
  'dateApplied:desc': (a, b) => (a.dateApplied < b.dateApplied ? 1 : a.dateApplied > b.dateApplied ? -1 : 0),
  'dateApplied:asc': (a, b) => (a.dateApplied < b.dateApplied ? -1 : a.dateApplied > b.dateApplied ? 1 : 0),
  'company:asc': (a, b) => a.company.localeCompare(b.company, undefined, { sensitivity: 'base' }),
  'updatedAt:desc': (a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0),
};

export function filterApplications(apps: Application[], query: ApplicationQuery): Page<Application> {
  const needle = normalize((query.q ?? '').trim());
  const { status, source, workMode, from, to } = query;

  const matched = apps.filter((a) => {
    if (needle && !searchableText(a).some((t) => normalize(t).includes(needle))) return false;
    if (status?.length && !status.includes(a.status)) return false;
    if (source?.length && !source.includes(a.source)) return false;
    if (workMode?.length && (!a.workMode || !workMode.includes(a.workMode))) return false;
    if (from && a.dateApplied < from) return false;
    if (to && a.dateApplied > to) return false;
    return true;
  });

  const cmp = comparators[query.sort];
  const sorted = [...matched].sort((a, b) => cmp(a, b) || byId(a, b));
  const start = (query.page - 1) * query.pageSize;
  return {
    items: sorted.slice(start, start + query.pageSize),
    total: sorted.length,
    page: query.page,
    pageSize: query.pageSize,
  };
}
