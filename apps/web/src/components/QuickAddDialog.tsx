import { useEffect, useId, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { CreateApplicationInputSchema, SOURCES, todayIso, type Source } from '@applications-db/shared';
import { useCreateApplication } from '../data/hooks';
import { SOURCE_LABELS } from '../lib/labels';
import { Field, inputClass } from './Field';

type Props = { open: boolean; onClose: () => void };

export function QuickAddDialog({ open, onClose }: Props) {
  // Mounted only while open so every opening starts from a fresh form.
  return open ? <QuickAddForm onClose={onClose} /> : null;
}

function QuickAddForm({ onClose }: { onClose: () => void }) {
  const uid = useId();
  const navigate = useNavigate();
  const create = useCreateApplication();
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [source, setSource] = useState<Source>(SOURCES[0]);
  const [dateApplied, setDateApplied] = useState(todayIso());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const parsed = CreateApplicationInputSchema.safeParse({ company, role, source, dateApplied });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0])] ??= issue.message;
      setErrors(next);
      return;
    }
    setErrors({});
    try {
      const created = await create.mutateAsync(parsed.data);
      onClose();
      navigate(`/applications/${created.id}`);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save the application');
    }
  }

  return (
    <div className="fixed inset-0 z-10 flex items-center justify-center bg-slate-900/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${uid}-title`}
        className="w-full max-w-md rounded bg-white p-5 shadow-lg"
      >
        <h2 id={`${uid}-title`} className="mb-4 text-lg font-semibold">
          Add application
        </h2>
        <form onSubmit={submit} noValidate className="space-y-3">
          {formError && (
            <p role="alert" className="rounded bg-red-50 px-3 py-2 text-sm text-red-800">
              {formError}
            </p>
          )}
          <Field id={`${uid}-company`} label="Company" error={errors.company}>
            <input
              id={`${uid}-company`}
              autoFocus
              className={inputClass}
              value={company}
              onChange={(e) => setCompany(e.target.value)}
            />
          </Field>
          <Field id={`${uid}-role`} label="Role" error={errors.role}>
            <input id={`${uid}-role`} className={inputClass} value={role} onChange={(e) => setRole(e.target.value)} />
          </Field>
          <Field id={`${uid}-source`} label="Source" error={errors.source}>
            <select
              id={`${uid}-source`}
              className={inputClass}
              value={source}
              onChange={(e) => setSource(e.target.value as Source)}
            >
              {SOURCES.map((s) => (
                <option key={s} value={s}>
                  {SOURCE_LABELS[s]}
                </option>
              ))}
            </select>
          </Field>
          <Field id={`${uid}-date`} label="Date applied" error={errors.dateApplied}>
            <input
              id={`${uid}-date`}
              type="date"
              className={inputClass}
              value={dateApplied}
              onChange={(e) => setDateApplied(e.target.value)}
            />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded border border-slate-300 px-3 py-1.5 text-sm">
              Cancel
            </button>
            <button
              type="submit"
              disabled={create.isPending}
              className="rounded bg-blue-700 px-3 py-1.5 text-sm text-white disabled:opacity-60"
            >
              Add
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
