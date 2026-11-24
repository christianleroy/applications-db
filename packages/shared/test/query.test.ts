import { describe, expect, it } from 'vitest';
import { createApplication } from '../src/history';
import { filterApplications } from '../src/query';
import { ApplicationQuerySchema, type Application, type CreateApplicationInput } from '../src/schemas';
import { NOW, ids } from './helpers';

const gen = ids(1000);
const make = (over: Partial<CreateApplicationInput> & { status?: Application['status'] } = {}): Application => {
  const { status, ...rest } = over;
  const app = createApplication(
    { company: 'Acme', role: 'Dev', source: 'linkedin', dateApplied: '2026-11-01', contacts: [], ...rest },
    gen,
    NOW,
  );
  return status ? { ...app, status } : app;
};
const q = (o: Record<string, unknown> = {}) => ApplicationQuerySchema.parse(o);

describe('filterApplications', () => {
  it('matches q as a plain substring, not a RegExp', () => {
    const apps = [make({ role: 'Senior C++ Engineer' }), make({ role: 'Ionet' })];
    expect(filterApplications(apps, q({ q: 'c++' })).items).toEqual([apps[0]]);
    expect(filterApplications(apps, q({ q: '.net' })).total).toBe(0);
  });

  it('ignores case and diacritics', () => {
    const apps = [make({ company: 'Société Générale' }), make({ company: 'Acme' })];
    expect(filterApplications(apps, q({ q: 'societe' })).items).toEqual([apps[0]]);
    expect(filterApplications(apps, q({ q: 'ACME' })).items).toEqual([apps[1]]);
  });

  it('treats blank q as no filter', () => {
    const apps = [make(), make()];
    expect(filterApplications(apps, q({ q: '   ' })).total).toBe(2);
  });

  it('matches a contact email and name', () => {
    const apps = [
      make({ contacts: [{ name: 'Jo Rec', email: 'jo@hire.io' }] }),
      make({ company: 'Other' }),
    ];
    expect(filterApplications(apps, q({ q: 'hire.io' })).items).toEqual([apps[0]]);
    expect(filterApplications(apps, q({ q: 'jo rec' })).items).toEqual([apps[0]]);
  });

  it('matches a contact role, phone and notes', () => {
    const apps = [
      make({ contacts: [{ name: 'Jo', role: 'Hiring Manager', phone: '555-0142', notes: 'prefers mornings' }] }),
      make({ company: 'Other' }),
    ];
    expect(filterApplications(apps, q({ q: 'hiring manager' })).items).toEqual([apps[0]]);
    expect(filterApplications(apps, q({ q: '555-0142' })).items).toEqual([apps[0]]);
    expect(filterApplications(apps, q({ q: 'MORNINGS' })).items).toEqual([apps[0]]);
  });

  it('ORs within a field and ANDs across fields', () => {
    const apps = [
      make({ source: 'referral', status: 'interview' }),
      make({ source: 'referral', status: 'offer' }),
      make({ source: 'referral', status: 'rejected' }),
      make({ source: 'linkedin', status: 'interview' }),
    ];
    const r = filterApplications(apps, q({ status: ['interview', 'offer'], source: ['referral'] }));
    expect(r.items.map((a) => a.id).sort()).toEqual([apps[0]!.id, apps[1]!.id].sort());
  });

  it('treats empty arrays as no filter', () => {
    const apps = [make(), make()];
    expect(filterApplications(apps, q({ status: [], source: [], workMode: [] })).total).toBe(2);
  });

  it('filters by work mode', () => {
    const apps = [make({ workMode: 'remote' }), make({ workMode: 'onsite' }), make()];
    expect(filterApplications(apps, q({ workMode: ['remote'] })).items).toEqual([apps[0]]);
  });

  it('includes both ends of the date range', () => {
    const apps = [
      make({ dateApplied: '2026-10-31' }),
      make({ dateApplied: '2026-11-01' }),
      make({ dateApplied: '2026-11-02' }),
    ];
    expect(filterApplications(apps, q({ from: '2026-11-01', to: '2026-11-01' })).items).toEqual([apps[1]]);
  });

  it('sorts by company ignoring case', () => {
    const apps = [make({ company: 'Zeta' }), make({ company: 'acme' }), make({ company: 'Beta' })];
    const r = filterApplications(apps, q({ sort: 'company:asc' }));
    expect(r.items.map((a) => a.company)).toEqual(['acme', 'Beta', 'Zeta']);
  });

  it('sorts by date and updatedAt, ties broken by id', () => {
    const a = make({ dateApplied: '2026-11-05' });
    const b = make({ dateApplied: '2026-11-05' });
    const c = make({ dateApplied: '2026-11-09' });
    const desc = filterApplications([a, b, c], q()).items;
    expect(desc[0]).toBe(c);
    expect(desc.slice(1).map((x) => x.id)).toEqual([a.id, b.id].sort());
    expect(filterApplications([c, a], q({ sort: 'dateApplied:asc' })).items[0]).toBe(a);
    const u1 = { ...a, updatedAt: '2026-11-24T00:00:00.000Z' };
    expect(filterApplications([c, u1], q({ sort: 'updatedAt:desc' })).items[0]).toBe(u1);
  });

  it('does not mutate the input array', () => {
    const apps = [make({ company: 'Zeta' }), make({ company: 'Beta' })];
    const copy = [...apps];
    filterApplications(apps, q({ sort: 'company:asc' }));
    expect(apps).toEqual(copy);
  });

  it('paginates and returns an empty page past the end', () => {
    const apps = Array.from({ length: 30 }, () => make());
    const p2 = filterApplications(apps, q({ page: 2, pageSize: 25 }));
    expect(p2.items).toHaveLength(5);
    expect(p2.total).toBe(30);
    const p3 = filterApplications(apps, q({ page: 3, pageSize: 25 }));
    expect(p3).toEqual({ items: [], total: 30, page: 3, pageSize: 25 });
  });
});
