import { useId, useState, type FormEvent } from 'react';
import { PROGRESS_STAGES, STATUSES, todayIso, type Application, type Status, type StatusEntry } from '@applications-db/shared';
import { useAddStatus, useRemoveStatus, useUpdateStatus } from '../data/hooks';
import { DOMAIN_ERROR_MESSAGES, STATUS_LABELS, isDomainErrorCode } from '../lib/labels';
import { formatDate } from '../lib/format';
import { inputClass } from './Field';

function errorMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'code' in err && typeof err.code === 'string' && isDomainErrorCode(err.code)) {
    return DOMAIN_ERROR_MESSAGES[err.code];
  }
  return err instanceof Error ? err.message : 'Something went wrong';
}

function nextStage(current: Status): Status {
  const i = (PROGRESS_STAGES as readonly Status[]).indexOf(current);
  return i >= 0 && i < PROGRESS_STAGES.length - 1 ? PROGRESS_STAGES[i + 1]! : 'rejected';
}

const labelClass = 'mb-1 block text-sm font-medium text-slate-700';

type FieldsProps = {
  uid: string;
  status: Status;
  date: string;
  note: string;
  onStatus: (s: Status) => void;
  onDate: (d: string) => void;
  onNote: (n: string) => void;
};

/** The status / date / note controls shared by the add and edit forms. */
function EntryFields({ uid, status, date, note, onStatus, onDate, onNote }: FieldsProps) {
  return (
    <>
      <div>
        <label htmlFor={`${uid}-status`} className={labelClass}>
          Status
        </label>
        <select id={`${uid}-status`} className={inputClass} value={status} onChange={(e) => onStatus(e.target.value as Status)}>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor={`${uid}-date`} className={labelClass}>
          Date
        </label>
        <input id={`${uid}-date`} type="date" className={inputClass} value={date} onChange={(e) => onDate(e.target.value)} />
      </div>
      <div>
        <label htmlFor={`${uid}-note`} className={labelClass}>
          Note
        </label>
        <input id={`${uid}-note`} className={inputClass} value={note} onChange={(e) => onNote(e.target.value)} />
      </div>
    </>
  );
}

type EntryProps = { applicationId: string; entry: StatusEntry; deletable: boolean; onChanged?: () => void };

function TimelineEntry({ applicationId, entry, deletable, onChanged }: EntryProps) {
  const uid = useId();
  const update = useUpdateStatus();
  const remove = useRemoveStatus();
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState<Status>(entry.status);
  const [date, setDate] = useState(entry.date);
  const [note, setNote] = useState(entry.note ?? '');
  const [error, setError] = useState<string | null>(null);

  async function save(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await update.mutateAsync({ id: applicationId, entryId: entry.id, patch: { status, date, note: note.trim() } });
      onChanged?.();
      setEditing(false);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function onDelete() {
    setError(null);
    try {
      await remove.mutateAsync({ id: applicationId, entryId: entry.id });
      onChanged?.();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  const label = `${STATUS_LABELS[entry.status]} on ${formatDate(entry.date)}`;

  return (
    <li className="rounded border border-slate-200 bg-white p-3">
      {editing ? (
        <form onSubmit={save} className="grid gap-3 sm:grid-cols-4">
          <EntryFields uid={uid} status={status} date={date} note={note} onStatus={setStatus} onDate={setDate} onNote={setNote} />
          <div className="flex items-end gap-2">
            <button type="submit" disabled={update.isPending} className="rounded bg-blue-700 px-3 py-1.5 text-sm text-white disabled:opacity-60">
              Save
            </button>
            <button type="button" onClick={() => setEditing(false)} className="rounded border border-slate-300 px-3 py-1.5 text-sm">
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="w-28 text-sm text-slate-600">{formatDate(entry.date)}</span>
          <span className="font-medium">{STATUS_LABELS[entry.status]}</span>
          {entry.note && <span className="flex-1 text-sm text-slate-700">{entry.note}</span>}
          <span className="ml-auto flex gap-2">
            <button
              type="button"
              aria-label={`Edit ${label}`}
              onClick={() => {
                setStatus(entry.status);
                setDate(entry.date);
                setNote(entry.note ?? '');
                setEditing(true);
              }}
              className="rounded border border-slate-300 px-2 py-1 text-sm"
            >
              Edit
            </button>
            {deletable && (
              <button
                type="button"
                aria-label={`Delete ${label}`}
                disabled={remove.isPending}
                onClick={onDelete}
                className="rounded border border-slate-300 px-2 py-1 text-sm text-red-700"
              >
                Delete
              </button>
            )}
          </span>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-700">
          {error}
        </p>
      )}
    </li>
  );
}

function AddStatusForm({ application, onChanged }: { application: Application; onChanged?: () => void }) {
  const uid = useId();
  const add = useAddStatus();
  const [status, setStatus] = useState<Status>(() => nextStage(application.status));
  const [date, setDate] = useState(todayIso());
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = note.trim();
    try {
      const updated = await add.mutateAsync({
        id: application.id,
        input: { status, date, ...(trimmed && { note: trimmed }) },
      });
      onChanged?.();
      setNote('');
      setStatus(nextStage(updated.status));
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-3 rounded border border-slate-200 bg-slate-50 p-3 sm:grid-cols-4">
      <EntryFields uid={uid} status={status} date={date} note={note} onStatus={setStatus} onDate={setDate} onNote={setNote} />
      <div className="flex items-end">
        <button type="submit" disabled={add.isPending} className="rounded bg-blue-700 px-3 py-1.5 text-sm text-white disabled:opacity-60">
          Add status
        </button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-700 sm:col-span-4">
          {error}
        </p>
      )}
    </form>
  );
}

export function StatusTimeline({ application, onChanged }: { application: Application; onChanged?: () => void }) {
  return (
    <section aria-label="Status timeline" className="space-y-3">
      <h2 className="text-lg font-semibold">Timeline</h2>
      <ol className="space-y-2">
        {application.statusHistory.map((entry, i) => (
          <TimelineEntry key={entry.id} applicationId={application.id} entry={entry} deletable={i > 0} onChanged={onChanged} />
        ))}
      </ol>
      <AddStatusForm application={application} onChanged={onChanged} />
    </section>
  );
}
