import { DomainError } from './errors';
import type {
  Application,
  CreateApplicationInput,
  StatusEntry,
  StatusEntryInput,
  StatusEntryPatch,
  UpdateApplicationInput,
} from './schemas';

export type IdGen = () => string;

/**
 * Sorts, validates and derives fields. `history[0]` must be the applied (first) entry
 * as it was before the operation, so ties keep it first and moves past other entries are detected.
 */
function finalize(app: Application, history: StatusEntry[], now: string): Application {
  const first = history[0]!;
  if (first.status !== 'applied') throw new DomainError('FIRST_ENTRY_MUST_BE_APPLIED');
  if (history.some((e) => e.date < first.date)) throw new DomainError('ENTRY_BEFORE_APPLIED');

  const sorted = history
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => (a.entry.date < b.entry.date ? -1 : a.entry.date > b.entry.date ? 1 : a.index - b.index))
    .map((x) => x.entry);

  return {
    ...app,
    statusHistory: sorted,
    status: sorted[sorted.length - 1]!.status,
    dateApplied: sorted[0]!.date,
    updatedAt: now,
  };
}

export function createApplication(input: CreateApplicationInput, newId: IdGen, now: string): Application {
  const firstId = newId();
  const app: Application = {
    ...input,
    id: newId(),
    status: 'applied',
    statusHistory: [],
    createdAt: now,
    updatedAt: now,
  };
  const first: StatusEntry = { id: firstId, status: 'applied', date: input.dateApplied };
  return finalize(app, [first], now);
}

export function updateApplication(app: Application, patch: UpdateApplicationInput, now: string): Application {
  const { dateApplied, ...rest } = patch;
  const history = app.statusHistory.map((e) => ({ ...e }));
  if (dateApplied !== undefined) history[0] = { ...history[0]!, date: dateApplied };
  return finalize({ ...app, ...rest }, history, now);
}

export function addStatusEntry(app: Application, input: StatusEntryInput, newId: IdGen, now: string): Application {
  return finalize(app, [...app.statusHistory, { ...input, id: newId() }], now);
}

export function updateStatusEntry(app: Application, entryId: string, patch: StatusEntryPatch, now: string): Application {
  if (!app.statusHistory.some((e) => e.id === entryId)) throw new DomainError('ENTRY_NOT_FOUND');
  return finalize(
    app,
    app.statusHistory.map((e) => (e.id === entryId ? { ...e, ...patch } : e)),
    now,
  );
}

export function removeStatusEntry(app: Application, entryId: string, now: string): Application {
  const index = app.statusHistory.findIndex((e) => e.id === entryId);
  if (index === -1) throw new DomainError('ENTRY_NOT_FOUND');
  if (index === 0) throw new DomainError('FIRST_ENTRY_NOT_DELETABLE');
  return finalize(app, app.statusHistory.filter((e) => e.id !== entryId), now);
}
