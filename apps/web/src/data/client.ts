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

export interface ApplicationsClient {
  list(q: ApplicationQuery): Promise<Page<Application>>;
  get(id: string): Promise<Application>;
  create(i: CreateApplicationInput): Promise<Application>;
  update(id: string, p: UpdateApplicationInput): Promise<Application>;
  remove(id: string): Promise<void>;
  addStatus(id: string, i: StatusEntryInput): Promise<Application>;
  updateStatus(id: string, entryId: string, p: StatusEntryPatch): Promise<Application>;
  removeStatus(id: string, entryId: string): Promise<Application>;
  dashboard(today: IsoDate): Promise<DashboardData>;
  statistics(): Promise<ReportData>;
  report(range: DateRange): Promise<ReportData>;
  health(): Promise<{ ok: boolean; storage: string }>;
}

export class ClientError extends Error {
  readonly status: number;
  readonly code: string;
  readonly issues?: unknown;

  constructor(status: number, code: string, message?: string, issues?: unknown) {
    super(message ?? code);
    this.name = 'ClientError';
    this.status = status;
    this.code = code;
    this.issues = issues;
  }
}
