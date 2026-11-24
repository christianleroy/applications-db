import { useId, useState, type FormEvent } from 'react';
import { PROGRESS_STAGES, STATUSES, todayIso, type Application, type Status, type StatusEntry } from '@applications-db/shared';
import { useAddStatus, useRemoveStatus, useUpdateStatus } from '../data/hooks';
import { errorMessage } from '../lib/errors';
import { STATUS_LABELS } from '../lib/labels';
import { formatDate } from '../lib/format';
import { STATUS_COLORS } from '../lib/statusColors';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Field } from './Field';

function nextStage(current: Status): Status {
  const i = (PROGRESS_STAGES as readonly Status[]).indexOf(current);
  return i >= 0 && i < PROGRESS_STAGES.length - 1 ? PROGRESS_STAGES[i + 1]! : 'rejected';
}

type FieldsProps = {
  uid: string;
  statusLocked?: boolean;
  status: Status;
  date: string;
  note: string;
  onStatus: (s: Status) => void;
  onDate: (d: string) => void;
  onNote: (n: string) => void;
};

/** The status / date / note controls shared by the add and edit forms. */
function EntryFields({ uid, statusLocked, status, date, note, onStatus, onDate, onNote }: FieldsProps) {
  return (
    <>
      <Field id={`${uid}-status`} label="Status">
        <NativeSelect id={`${uid}-status`} value={status} disabled={statusLocked} onChange={(e) => onStatus(e.target.value as Status)}>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field id={`${uid}-date`} label="Date">
        <Input id={`${uid}-date`} type="date" value={date} onChange={(e) => onDate(e.target.value)} />
      </Field>
      <Field id={`${uid}-note`} label="Note">
        <Input id={`${uid}-note`} value={note} onChange={(e) => onNote(e.target.value)} />
      </Field>
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
    <li className="px-5 py-3">
      {editing ? (
        <form onSubmit={save} className="grid gap-3 sm:grid-cols-4">
          <EntryFields uid={uid} statusLocked={!deletable} status={status} date={date} note={note} onStatus={setStatus} onDate={setDate} onNote={setNote} />
          <div className="flex items-end gap-2">
            <Button type="submit" size="sm" disabled={update.isPending}>
              Save
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="w-28 text-sm text-muted-foreground tabular-nums">{formatDate(entry.date)}</span>
          <span className="flex items-center gap-2 font-medium">
            <span aria-hidden="true" className="size-2 rounded-full" style={{ backgroundColor: STATUS_COLORS[entry.status].hex }} />
            {STATUS_LABELS[entry.status]}
          </span>
          {entry.note && <span className="flex-1 text-sm text-muted-foreground">{entry.note}</span>}
          <span className="ml-auto flex gap-1">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              aria-label={`Edit ${label}`}
              onClick={() => {
                setStatus(entry.status);
                setDate(entry.date);
                setNote(entry.note ?? '');
                setEditing(true);
              }}
            >
              Edit
            </Button>
            {deletable && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    aria-label={`Delete ${label}`}
                    disabled={remove.isPending}
                    className="text-destructive hover:bg-destructive/5 hover:text-destructive"
                  >
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete status entry</AlertDialogTitle>
                    <AlertDialogDescription>Remove “{label}” from the timeline? This can't be undone.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction className={buttonVariants({ variant: 'destructive' })} onClick={() => void onDelete()}>
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </span>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-destructive">
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
    <form onSubmit={submit} className="grid gap-3 border-t bg-muted/40 px-5 py-4 sm:grid-cols-4">
      <EntryFields uid={uid} status={status} date={date} note={note} onStatus={setStatus} onDate={setDate} onNote={setNote} />
      <div className="flex items-end">
        <Button type="submit" disabled={add.isPending} className="w-full sm:w-auto">
          Add status
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive sm:col-span-4">
          {error}
        </p>
      )}
    </form>
  );
}

export function StatusTimeline({ application, onChanged }: { application: Application; onChanged?: () => void }) {
  return (
    <section aria-label="Status timeline">
      <Card className="gap-0 overflow-hidden pb-0">
        <CardHeader className="pb-3">
          <CardTitle>
            <h2 className="text-base">Timeline</h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <ol className="divide-y border-t">
            {application.statusHistory.map((entry, i) => (
              <TimelineEntry key={entry.id} applicationId={application.id} entry={entry} deletable={i > 0} onChanged={onChanged} />
            ))}
          </ol>
          <AddStatusForm application={application} onChanged={onChanged} />
        </CardContent>
      </Card>
    </section>
  );
}
