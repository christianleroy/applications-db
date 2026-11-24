import type { ApplicationQuery, CreateApplicationInput } from '@applications-db/shared';
import { ClientError } from './client';
import { MemoryClient } from './memoryClient';

const query = (over: Partial<ApplicationQuery> = {}): ApplicationQuery => ({
  sort: 'dateApplied:desc',
  page: 1,
  pageSize: 25,
  ...over,
});

const input = (over: Partial<CreateApplicationInput> = {}): CreateApplicationInput => ({
  company: 'Acme',
  role: 'Engineer',
  source: 'linkedin',
  dateApplied: '2026-11-01',
  contacts: [],
  ...over,
});

const fixedClock = { now: () => new Date('2026-11-23T10:00:00.000Z') };

async function rejection(p: Promise<unknown>): Promise<ClientError> {
  try {
    await p;
  } catch (e) {
    expect(e).toBeInstanceOf(ClientError);
    return e as ClientError;
  }
  throw new Error('expected rejection');
}

describe('MemoryClient', () => {
  it('creates then gets an application', async () => {
    const client = new MemoryClient([], fixedClock);
    const created = await client.create(input());
    expect(created.status).toBe('applied');
    expect(created.createdAt).toBe('2026-11-23T10:00:00.000Z');
    expect(await client.get(created.id)).toEqual(created);
  });

  it('finds a created application by search text', async () => {
    const client = new MemoryClient();
    await client.create(input());
    await client.create(input({ company: 'Globex' }));
    const page = await client.list(query({ q: 'acme' }));
    expect(page.total).toBe(1);
    expect(page.items[0]?.company).toBe('Acme');
  });

  it('rejects an invalid update with a 400 VALIDATION error', async () => {
    const client = new MemoryClient();
    const app = await client.create(input());
    const err = await rejection(client.update(app.id, { company: '' }));
    expect(err.status).toBe(400);
    expect(err.code).toBe('VALIDATION');
  });

  it('does not wipe a field when the patch value is explicitly undefined', async () => {
    const client = new MemoryClient();
    const app = await client.create(input());
    const updated = await client.update(app.id, {
      company: undefined,
      role: 'Staff Engineer',
    });
    expect(updated.company).toBe('Acme');
    expect(updated.role).toBe('Staff Engineer');
  });

  it('maps a domain error to 409 with the same code', async () => {
    const client = new MemoryClient();
    const app = await client.create(input());
    const err = await rejection(client.addStatus(app.id, { status: 'screening', date: '2026-10-01' }));
    expect(err.status).toBe(409);
    expect(err.code).toBe('ENTRY_BEFORE_APPLIED');
  });

  it('rejects a missing id with 404', async () => {
    const client = new MemoryClient();
    const err = await rejection(client.get('missing'));
    expect(err.status).toBe(404);
    expect(err.code).toBe('NOT_FOUND');
    expect((await rejection(client.remove('missing'))).status).toBe(404);
    expect((await rejection(client.update('missing', {}))).status).toBe(404);
  });

  it('returns copies so mutating a result does not change stored data', async () => {
    const client = new MemoryClient();
    const app = await client.create(input());
    const copy = await client.get(app.id);
    copy.company = 'Hacked';
    copy.statusHistory.push({ id: 'x', status: 'offer', date: '2026-11-02' });
    expect((await client.get(app.id)).company).toBe('Acme');
    expect((await client.get(app.id)).statusHistory).toHaveLength(1);
  });

  it('adds, updates and removes status entries and removes applications', async () => {
    const client = new MemoryClient();
    const app = await client.create(input());
    const withEntry = await client.addStatus(app.id, {
      status: 'screening',
      date: '2026-11-05',
    });
    expect(withEntry.status).toBe('screening');
    const entryId = withEntry.statusHistory[1]!.id;
    const patched = await client.updateStatus(app.id, entryId, {
      status: 'interview',
    });
    expect(patched.status).toBe('interview');
    const removed = await client.removeStatus(app.id, entryId);
    expect(removed.status).toBe('applied');
    await client.remove(app.id);
    expect((await client.list(query())).total).toBe(0);
  });

  it('computes dashboard, statistics and report through the shared functions', async () => {
    const client = new MemoryClient();
    await client.create(input());
    expect((await client.dashboard('2026-11-23')).activeCount).toBe(1);
    expect(await client.statistics()).toBeDefined();
    expect(await client.report({ from: '2026-11-01', to: '2026-11-30' })).toBeDefined();
    expect((await rejection(client.report({ from: '2026-12-01', to: '2026-11-01' }))).status).toBe(400);
  });

  it('reports memory health', async () => {
    expect(await new MemoryClient().health()).toEqual({
      ok: true,
      storage: 'memory',
    });
  });
});
