import type {
  Application,
  ApplicationQuery,
  CreateApplicationInput,
  DashboardData,
  DateRange,
  IsoDate,
  Page,
  ReportData,
  StatusEntryInput,
  StatusEntryPatch,
  UpdateApplicationInput,
} from '@applications-db/shared';
import { ClientError, type ApplicationsClient } from './client';

type FetchFn = typeof fetch;

const QUERY_ORDER = ['q', 'status', 'source', 'workMode', 'from', 'to', 'page', 'pageSize', 'sort'] as const;

function queryString(q: ApplicationQuery): string {
  const params = new URLSearchParams();
  for (const key of QUERY_ORDER) {
    const value = q[key];
    if (value === undefined || value === '') continue;
    if (Array.isArray(value)) value.forEach((v) => params.append(key, v));
    else params.append(key, String(value));
  }
  return params.toString();
}

const seg = encodeURIComponent;

export class ApiClient implements ApplicationsClient {
  private readonly baseUrl: string;

  constructor(
    baseUrl: string,
    private readonly fetchFn: FetchFn = (...args) => fetch(...args),
  ) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  private async send(method: string, path: string, body?: unknown): Promise<Response> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    let res: Response;
    try {
      res = await this.fetchFn(`${this.baseUrl}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (e) {
      throw new ClientError(0, 'NETWORK', e instanceof Error ? e.message : 'Network error');
    }
    if (!res.ok) throw await this.toError(res);
    return res;
  }

  private async toError(res: Response): Promise<ClientError> {
    const fallback = `HTTP_${res.status}`;
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      return new ClientError(res.status, fallback);
    }
    if (body && typeof body === 'object' && typeof (body as { code?: unknown }).code === 'string') {
      const { code, message, issues } = body as {
        code: string;
        message?: unknown;
        issues?: unknown;
      };
      return new ClientError(res.status, code, typeof message === 'string' ? message : undefined, issues);
    }
    return new ClientError(res.status, fallback);
  }

  private async json<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await this.send(method, path, body);
    return (await res.json()) as T;
  }

  list(q: ApplicationQuery): Promise<Page<Application>> {
    return this.json('GET', `/applications?${queryString(q)}`);
  }

  get(id: string): Promise<Application> {
    return this.json('GET', `/applications/${seg(id)}`);
  }

  create(i: CreateApplicationInput): Promise<Application> {
    return this.json('POST', '/applications', i);
  }

  update(id: string, p: UpdateApplicationInput): Promise<Application> {
    return this.json('PATCH', `/applications/${seg(id)}`, p);
  }

  async remove(id: string): Promise<void> {
    await this.send('DELETE', `/applications/${seg(id)}`);
  }

  addStatus(id: string, i: StatusEntryInput): Promise<Application> {
    return this.json('POST', `/applications/${seg(id)}/status`, i);
  }

  updateStatus(id: string, entryId: string, p: StatusEntryPatch): Promise<Application> {
    return this.json('PATCH', `/applications/${seg(id)}/status/${seg(entryId)}`, p);
  }

  removeStatus(id: string, entryId: string): Promise<Application> {
    return this.json('DELETE', `/applications/${seg(id)}/status/${seg(entryId)}`);
  }

  dashboard(today: IsoDate): Promise<DashboardData> {
    return this.json('GET', `/dashboard?${new URLSearchParams({ today })}`);
  }

  statistics(): Promise<ReportData> {
    return this.json('GET', '/stats');
  }

  report(range: DateRange): Promise<ReportData> {
    return this.json('GET', `/reports?${new URLSearchParams({ from: range.from, to: range.to })}`);
  }

  health(): Promise<{ ok: boolean; storage: string }> {
    return this.json('GET', '/health');
  }
}
