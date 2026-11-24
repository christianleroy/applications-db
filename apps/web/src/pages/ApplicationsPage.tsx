import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ApplicationQuerySchema,
  SOURCES,
  STATUSES,
  WORK_MODES,
  lastChangeDate,
  type ApplicationQuery,
  type SortKey,
} from '@applications-db/shared';
import { ChevronLeftIcon, ChevronRightIcon, SearchIcon } from 'lucide-react';
import { EmptyState } from '../components/EmptyState';
import { Field } from '../components/Field';
import { PageHeader, PageStatus } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useApplications } from '../data/hooks';
import { formatDate } from '../lib/format';
import { SOURCE_LABELS, STATUS_LABELS, WORK_MODE_LABELS } from '../lib/labels';

const SEARCH_DEBOUNCE_MS = 250;

const SORT_LABELS: Record<SortKey, string> = {
  'dateApplied:desc': 'Date applied (newest)',
  'dateApplied:asc': 'Date applied (oldest)',
  'company:asc': 'Company (A-Z)',
  'updatedAt:desc': 'Recently updated',
};

type ListKey = 'status' | 'source' | 'workMode';

const FILTER_GROUPS: { key: ListKey; legend: string; options: readonly string[]; labels: Record<string, string> }[] = [
  { key: 'status', legend: 'Status', options: STATUSES, labels: STATUS_LABELS },
  { key: 'source', legend: 'Source', options: SOURCES, labels: SOURCE_LABELS },
  { key: 'workMode', legend: 'Work mode', options: WORK_MODES, labels: WORK_MODE_LABELS },
];

/** Reads the query from URL params; values that fail validation are dropped rather than raised. */
function parseQuery(params: URLSearchParams): ApplicationQuery {
  const raw: Record<string, unknown> = {};
  const q = params.get('q');
  if (q) raw.q = q;
  for (const key of ['status', 'source', 'workMode'] as const) {
    const values = params.getAll(key);
    if (values.length) raw[key] = values;
  }
  for (const key of ['from', 'to', 'sort'] as const) {
    const v = params.get(key);
    if (v) raw[key] = v;
  }
  for (const key of ['page', 'pageSize'] as const) {
    const v = params.get(key);
    if (v) raw[key] = Number(v);
  }

  // Keep only the valid members of list filters, then drop any other key that still fails validation.
  const lists = { status: STATUSES, source: SOURCES, workMode: WORK_MODES } as const;
  for (const key of Object.keys(lists) as ListKey[]) {
    if (!Array.isArray(raw[key])) continue;
    const valid = (raw[key] as string[]).filter((v) => (lists[key] as readonly string[]).includes(v));
    if (valid.length) raw[key] = valid;
    else delete raw[key];
  }
  for (;;) {
    const parsed = ApplicationQuerySchema.safeParse(raw);
    if (parsed.success) return parsed.data;
    const keys = parsed.error.issues.map((i) => String(i.path[0])).filter((k) => k in raw);
    if (keys.length === 0) return ApplicationQuerySchema.parse({});
    for (const k of keys) delete raw[k];
  }
}

function toParams(q: ApplicationQuery): URLSearchParams {
  const p = new URLSearchParams();
  if (q.q) p.set('q', q.q);
  for (const key of ['status', 'source', 'workMode'] as const) for (const v of q[key] ?? []) p.append(key, v);
  if (q.from) p.set('from', q.from);
  if (q.to) p.set('to', q.to);
  if (q.sort !== 'dateApplied:desc') p.set('sort', q.sort);
  if (q.page !== 1) p.set('page', String(q.page));
  if (q.pageSize !== 25) p.set('pageSize', String(q.pageSize));
  return p;
}

export function ApplicationsPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const query = parseQuery(params);
  const { data, isPending, isError } = useApplications(query);

  const update = (patch: Partial<ApplicationQuery>) => setParams(toParams({ ...query, page: 1, ...patch }));

  const [search, setSearch] = useState(query.q ?? '');
  const urlSearch = query.q ?? '';
  // Follow URL changes made elsewhere (Clear filters, back/forward).
  useEffect(() => setSearch(urlSearch), [urlSearch]);
  // Debounced write of the search box to the URL.
  useEffect(() => {
    if (search.trim() === urlSearch) return;
    const t = setTimeout(() => setParams(toParams({ ...parseQuery(params), q: search.trim() || undefined, page: 1 })), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [search, urlSearch, params, setParams]);

  const toggle = (key: ListKey, value: string) => {
    const current: string[] = query[key] ?? [];
    const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
    update({ [key]: next.length ? next : undefined } as Partial<ApplicationQuery>);
  };

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="space-y-6">
      <PageHeader title="Applications" />

      <section aria-label="Filters" className="grid gap-x-6 gap-y-5 rounded-lg border bg-card p-5 md:grid-cols-4">
        <Field id="app-search" label="Search" className="md:col-span-2">
          <div className="relative">
            <SearchIcon aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="app-search"
              type="search"
              className="pl-9"
              placeholder="Company, role, notes, contacts"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </Field>
        <Field id="app-from" label="Applied from">
          <Input id="app-from" type="date" value={query.from ?? ''} onChange={(e) => update({ from: e.target.value || undefined })} />
        </Field>
        <Field id="app-to" label="Applied to">
          <Input id="app-to" type="date" value={query.to ?? ''} onChange={(e) => update({ to: e.target.value || undefined })} />
        </Field>
        {FILTER_GROUPS.map((g) => (
          <fieldset key={g.key} className="min-w-0">
            <legend className="mb-2 text-sm leading-none font-medium">{g.legend}</legend>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
              {g.options.map((o) => (
                <label key={o} className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="size-4 shrink-0 cursor-pointer rounded accent-primary"
                    checked={(query[g.key] as string[] | undefined)?.includes(o) ?? false}
                    onChange={() => toggle(g.key, o)}
                  />
                  {g.labels[o]}
                </label>
              ))}
            </div>
          </fieldset>
        ))}
        <Field id="app-sort" label="Sort by">
          <NativeSelect id="app-sort" value={query.sort} onChange={(e) => update({ sort: e.target.value as SortKey })}>
            {(Object.keys(SORT_LABELS) as SortKey[]).map((s) => (
              <option key={s} value={s}>
                {SORT_LABELS[s]}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </section>

      {isPending && <PageStatus>Loading...</PageStatus>}
      {isError && <PageStatus error>Could not load applications.</PageStatus>}
      {data && data.items.length === 0 && (
        <EmptyState
          title="No applications match these filters"
          action={
            <Button type="button" variant="outline" size="sm" onClick={() => setParams(new URLSearchParams())}>
              Clear filters
            </Button>
          }
        />
      )}
      {data && data.items.length > 0 && (
        <>
          <div className="overflow-hidden rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Company</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Date applied</TableHead>
                  <TableHead>Last change</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((a) => (
                  <TableRow key={a.id} onClick={() => navigate(`/applications/${a.id}`)} className="cursor-pointer">
                    <TableCell className="font-medium">
                      <Link
                        to={`/applications/${a.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="underline-offset-4 hover:text-primary hover:underline"
                      >
                        {a.company}
                      </Link>
                    </TableCell>
                    <TableCell>{a.role}</TableCell>
                    <TableCell>
                      <StatusBadge status={a.status} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">{SOURCE_LABELS[a.source]}</TableCell>
                    <TableCell className="text-muted-foreground tabular-nums">{formatDate(a.dateApplied)}</TableCell>
                    <TableCell className="text-muted-foreground tabular-nums">{formatDate(lastChangeDate(a))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <span className="text-muted-foreground">
              {data.total} application{data.total === 1 ? '' : 's'} - page {data.page} of {totalPages}
            </span>
            <span className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={data.page <= 1}
                onClick={() => setParams(toParams({ ...query, page: data.page - 1 }))}
              >
                <ChevronLeftIcon aria-hidden="true" />
                Previous
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={data.page >= totalPages}
                onClick={() => setParams(toParams({ ...query, page: data.page + 1 }))}
              >
                Next
                <ChevronRightIcon aria-hidden="true" />
              </Button>
            </span>
          </nav>
        </>
      )}
    </div>
  );
}
