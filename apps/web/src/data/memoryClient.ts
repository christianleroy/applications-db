import {
  ApplicationQuerySchema,
  CreateApplicationInputSchema,
  DateRangeSchema,
  DomainError,
  StatusEntryInputSchema,
  StatusEntryPatchSchema,
  UpdateApplicationInputSchema,
  addStatusEntry,
  computeDashboard,
  computeReport,
  createApplication,
  filterApplications,
  removeStatusEntry,
  updateApplication,
  updateStatusEntry,
  type Application,
  type ApplicationQuery,
  type CreateApplicationInput,
  type DashboardData,
  type DateRange,
  type IsoDate,
  type Page,
  type ReportData,
  type StatusEntryInput,
  type StatusEntryPatch,
  type UpdateApplicationInput,
} from '@applications-db/shared';
import { ClientError, type ApplicationsClient } from './client';

type Clock = { now: () => Date };

type Schema<T> = {
  safeParse(value: unknown): { success: true; data: T } | { success: false; error: { issues: { message: string }[] } };
};

function parse<T>(schema: Schema<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new ClientError(400, 'VALIDATION', result.error.issues[0]?.message ?? 'Invalid input', result.error.issues);
  }
  return result.data;
}

/** Drops keys whose value is undefined so an explicit `{ field: undefined }` cannot wipe a field. */
function dropUndefined<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T;
}

export class MemoryClient implements ApplicationsClient {
  private apps: Application[];

  constructor(
    initial: Application[] = [],
    private readonly clock: Clock = { now: () => new Date() },
  ) {
    this.apps = structuredClone(initial);
  }

  private nowIso(): string {
    return this.clock.now().toISOString();
  }

  private find(id: string): Application {
    const app = this.apps.find((a) => a.id === id);
    if (!app) throw new ClientError(404, 'NOT_FOUND', `Application ${id} not found`);
    return app;
  }

  private replace(next: Application): Application {
    this.apps = this.apps.map((a) => (a.id === next.id ? next : a));
    return structuredClone(next);
  }

  /** Runs synchronously, mapping DomainError to ClientError 409, and wraps the outcome in a promise. */
  private async run<T>(fn: () => T): Promise<T> {
    try {
      return fn();
    } catch (e) {
      if (e instanceof DomainError) throw new ClientError(409, e.code, e.message);
      throw e;
    }
  }

  list(q: ApplicationQuery): Promise<Page<Application>> {
    return this.run(() => structuredClone(filterApplications(this.apps, parse(ApplicationQuerySchema, q))));
  }

  get(id: string): Promise<Application> {
    return this.run(() => structuredClone(this.find(id)));
  }

  create(i: CreateApplicationInput): Promise<Application> {
    return this.run(() => {
      const input = dropUndefined(parse(CreateApplicationInputSchema, i));
      const app = createApplication(input, () => crypto.randomUUID(), this.nowIso());
      this.apps = [...this.apps, app];
      return structuredClone(app);
    });
  }

  update(id: string, p: UpdateApplicationInput): Promise<Application> {
    return this.run(() => {
      const patch = dropUndefined(parse(UpdateApplicationInputSchema, p));
      return this.replace(updateApplication(this.find(id), patch, this.nowIso()));
    });
  }

  remove(id: string): Promise<void> {
    return this.run(() => {
      this.find(id);
      this.apps = this.apps.filter((a) => a.id !== id);
    });
  }

  addStatus(id: string, i: StatusEntryInput): Promise<Application> {
    return this.run(() => {
      const input = dropUndefined(parse(StatusEntryInputSchema, i));
      return this.replace(addStatusEntry(this.find(id), input, () => crypto.randomUUID(), this.nowIso()));
    });
  }

  updateStatus(id: string, entryId: string, p: StatusEntryPatch): Promise<Application> {
    return this.run(() => {
      const patch = dropUndefined(parse(StatusEntryPatchSchema, p));
      return this.replace(updateStatusEntry(this.find(id), entryId, patch, this.nowIso()));
    });
  }

  removeStatus(id: string, entryId: string): Promise<Application> {
    return this.run(() => this.replace(removeStatusEntry(this.find(id), entryId, this.nowIso())));
  }

  dashboard(today: IsoDate): Promise<DashboardData> {
    return this.run(() => structuredClone(computeDashboard(this.apps, today)));
  }

  statistics(): Promise<ReportData> {
    return this.run(() => structuredClone(computeReport(this.apps)));
  }

  report(range: DateRange): Promise<ReportData> {
    return this.run(() => structuredClone(computeReport(this.apps, parse(DateRangeSchema, range))));
  }

  health(): Promise<{ ok: boolean; storage: string }> {
    return Promise.resolve({ ok: true, storage: 'memory' });
  }
}
