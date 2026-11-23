import { describe, expect, it } from 'vitest';
import {
  addStatusEntry,
  createApplication,
  removeStatusEntry,
  updateApplication,
  updateStatusEntry,
  type IdGen,
} from '../src/history';

const NOW = '2026-11-23T10:00:00.000Z';
const LATER = '2026-11-24T10:00:00.000Z';
const ids = (start = 1): IdGen => {
  let n = start;
  return () => `id-${n++}`;
};

describe('history operations', () => {
  const base = createApplication(
    { company: 'Acme', role: 'Dev', source: 'linkedin', dateApplied: '2026-11-01', contacts: [] },
    ids(),
    NOW,
  );

  it('creates with a single applied entry', () => {
    expect(base.status).toBe('applied');
    expect(base.createdAt).toBe(NOW);
    expect(base.updatedAt).toBe(NOW);
    expect(base.statusHistory).toEqual([{ id: 'id-1', status: 'applied', date: '2026-11-01' }]);
  });
  it('adding an entry dated earlier than a later one keeps date order and derives status', () => {
    let a = addStatusEntry(base, { status: 'interview', date: '2026-11-10' }, ids(10), NOW);
    a = addStatusEntry(a, { status: 'screening', date: '2026-11-05' }, ids(20), NOW);
    expect(a.statusHistory.map((e) => e.status)).toEqual(['applied', 'screening', 'interview']);
    expect(a.status).toBe('interview');
  });
  it('keeps insertion order for entries on the same date', () => {
    let a = addStatusEntry(base, { status: 'screening', date: '2026-11-05' }, ids(10), NOW);
    a = addStatusEntry(a, { status: 'interview', date: '2026-11-05' }, ids(20), NOW);
    a = addStatusEntry(a, { status: 'applied', date: '2026-11-01' }, ids(30), NOW);
    expect(a.statusHistory.map((e) => e.id)).toEqual(['id-1', 'id-30', 'id-10', 'id-20']);
  });
  it('editing dateApplied moves the first entry date and sets updatedAt', () => {
    const a = updateApplication(base, { dateApplied: '2026-10-30' }, LATER);
    expect(a.statusHistory[0]!.date).toBe('2026-10-30');
    expect(a.dateApplied).toBe('2026-10-30');
    expect(a.updatedAt).toBe(LATER);
  });
  it('updates only the keys present in the patch', () => {
    const withContacts = { ...base, contacts: [{ name: 'Pat' }], notes: 'keep' };
    const a = updateApplication(withContacts, { company: 'Globex' }, NOW);
    expect(a.company).toBe('Globex');
    expect(a.contacts).toEqual([{ name: 'Pat' }]);
    expect(a.notes).toBe('keep');
  });
  it('editing the first entry date updates dateApplied', () => {
    expect(updateStatusEntry(base, 'id-1', { date: '2026-10-29' }, NOW).dateApplied).toBe('2026-10-29');
  });
  it('rejects an entry before applied', () => {
    expect(() => addStatusEntry(base, { status: 'screening', date: '2026-10-01' }, ids(), NOW)).toThrowError(
      expect.objectContaining({ code: 'ENTRY_BEFORE_APPLIED' }),
    );
  });
  it('rejects moving dateApplied after a later entry', () => {
    const a = addStatusEntry(base, { status: 'screening', date: '2026-11-05' }, ids(10), NOW);
    expect(() => updateApplication(a, { dateApplied: '2026-11-06' }, NOW)).toThrowError(
      expect.objectContaining({ code: 'ENTRY_BEFORE_APPLIED' }),
    );
  });
  it('rejects editing another entry to before applied', () => {
    const a = addStatusEntry(base, { status: 'screening', date: '2026-11-05' }, ids(10), NOW);
    expect(() => updateStatusEntry(a, 'id-10', { date: '2026-10-01' }, NOW)).toThrowError(
      expect.objectContaining({ code: 'ENTRY_BEFORE_APPLIED' }),
    );
  });
  it('rejects changing the first entry status', () => {
    expect(() => updateStatusEntry(base, 'id-1', { status: 'screening' }, NOW)).toThrowError(
      expect.objectContaining({ code: 'FIRST_ENTRY_MUST_BE_APPLIED' }),
    );
  });
  it('rejects deleting the first entry; deleting the last re-derives status', () => {
    expect(() => removeStatusEntry(base, 'id-1', NOW)).toThrowError(
      expect.objectContaining({ code: 'FIRST_ENTRY_NOT_DELETABLE' }),
    );
    const a = addStatusEntry(base, { status: 'rejected', date: '2026-11-05' }, ids(10), NOW);
    expect(removeStatusEntry(a, 'id-10', NOW).status).toBe('applied');
  });
  it('unknown entry id throws ENTRY_NOT_FOUND', () => {
    expect(() => removeStatusEntry(base, 'nope', NOW)).toThrowError(expect.objectContaining({ code: 'ENTRY_NOT_FOUND' }));
    expect(() => updateStatusEntry(base, 'nope', { note: 'x' }, NOW)).toThrowError(
      expect.objectContaining({ code: 'ENTRY_NOT_FOUND' }),
    );
  });
  it('does not mutate its input', () => {
    const snapshot = structuredClone(base);
    addStatusEntry(base, { status: 'screening', date: '2026-11-05' }, ids(), NOW);
    updateApplication(base, { dateApplied: '2026-10-30', company: 'X' }, NOW);
    updateStatusEntry(base, 'id-1', { date: '2026-10-29' }, NOW);
    expect(base).toEqual(snapshot);
  });
});
