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
import { EmptyState } from '../components/EmptyState';
import { inputClass } from '../components/Field';
import { StatusBadge } from '../components/StatusBadge';
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
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Applications</h1>

      <div className="grid gap-4 rounded border border-slate-200 bg-white p-4 md:grid-cols-4">
        <div className="md:col-span-2">
          <label htmlFor="app-search" className="mb-1 block text-sm font-medium text-slate-700">
            Search
          </label>
          <input
            id="app-search"
            type="search"
            className={inputClass}
            placeholder="Company, role, notes, contacts"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="app-from" className="mb-1 block text-sm font-medium text-slate-700">
            Applied from
          </label>
          <input id="app-from" type="date" className={inputClass} value={query.from ?? ''} onChange={(e) => update({ from: e.target.value || undefined })} />
        </div>
        <div>
          <label htmlFor="app-to" className="mb-1 block text-sm font-medium text-slate-700">
            Applied to
          </label>
          <input id="app-to" type="date" className={inputClass} value={query.to ?? ''} onChange={(e) => update({ to: e.target.value || undefined })} />
        </div>
        {FILTER_GROUPS.map((g) => (
          <fieldset key={g.key} className="md:col-span-1">
            <legend className="mb-1 text-sm font-medium text-slate-700">{g.legend}</legend>
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              {g.options.map((o) => (
                <label key={o} className="flex items-center gap-1 text-sm">
                  <input type="checkbox" checked={(query[g.key] as string[] | undefined)?.includes(o) ?? false} onChange={() => toggle(g.key, o)} />
                  {g.labels[o]}
                </label>
              ))}
            </div>
          </fieldset>
        ))}
        <div>
          <label htmlFor="app-sort" className="mb-1 block text-sm font-medium text-slate-700">
            Sort by
          </label>
          <select id="app-sort" className={inputClass} value={query.sort} onChange={(e) => update({ sort: e.target.value as SortKey })}>
            {(Object.keys(SORT_LABELS) as SortKey[]).map((s) => (
              <option key={s} value={s}>
                {SORT_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isPending && <p className="text-slate-600">Loading...</p>}
      {isError && (
        <p role="alert" className="rounded bg-red-50 px-3 py-2 text-sm text-red-800">
          Could not load applications.
        </p>
      )}
      {data && data.items.length === 0 && (
        <EmptyState
          title="No applications match these filters"
          action={
            <button type="button" onClick={() => setParams(new URLSearchParams())} className="rounded border border-slate-300 px-3 py-1.5 text-sm">
              Clear filters
            </button>
          }
        />
      )}
      {data && data.items.length > 0 && (
        <>
          <div className="overflow-x-auto rounded border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-3 py-2">Company</th>
                  <th className="px-3 py-2">Role</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Source</th>
                  <th className="px-3 py-2">Date applied</th>
                  <th className="px-3 py-2">Last change</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((a) => (
                  <tr key={a.id} onClick={() => navigate(`/applications/${a.id}`)} className="cursor-pointer border-b border-slate-100 last:border-0 hover:bg-slate-50">
                    <td className="px-3 py-2 font-medium">
                      <Link to={`/applications/${a.id}`} onClick={(e) => e.stopPropagation()} className="text-blue-700 hover:underline">
                        {a.company}
                      </Link>
                    </td>
                    <td className="px-3 py-2">{a.role}</td>
                    <td className="px-3 py-2">
                      <StatusBadge status={a.status} />
                    </td>
                    <td className="px-3 py-2">{SOURCE_LABELS[a.source]}</td>
                    <td className="px-3 py-2">{formatDate(a.dateApplied)}</td>
                    <td className="px-3 py-2">{formatDate(lastChangeDate(a))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <nav aria-label="Pagination" className="flex items-center justify-between text-sm">
            <span className="text-slate-600">
              {data.total} application{data.total === 1 ? '' : 's'} - page {data.page} of {totalPages}
            </span>
            <span className="flex gap-2">
              <button
                type="button"
                disabled={data.page <= 1}
                onClick={() => setParams(toParams({ ...query, page: data.page - 1 }))}
                className="rounded border border-slate-300 px-3 py-1.5 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={data.page >= totalPages}
                onClick={() => setParams(toParams({ ...query, page: data.page + 1 }))}
                className="rounded border border-slate-300 px-3 py-1.5 disabled:opacity-50"
              >
                Next
              </button>
            </span>
          </nav>
        </>
      )}
    </div>
  );
}
