import { useId, useState, type FormEvent, type ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import { CreateApplicationInputSchema, SOURCES, todayIso, type Source } from '@applications-db/shared';
import { useCreateApplication } from '../data/hooks';
import { SOURCE_LABELS } from '../lib/labels';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Field, errorProps } from './Field';

type Props = {
  open: boolean;
  onClose: () => void;
  /** Optional button that opens the dialog; focus returns to it when the dialog closes. */
  trigger?: ReactElement;
};

export function QuickAddDialog({ open, onClose, trigger }: Props) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add application</DialogTitle>
          <DialogDescription>The essentials now; add the details on the next page.</DialogDescription>
        </DialogHeader>
        {/* Content unmounts while closed, so every opening starts from a fresh form. */}
        <QuickAddForm onClose={onClose} />
      </DialogContent>
    </Dialog>
  );
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
    <form onSubmit={submit} noValidate className="grid gap-4">
      {formError && (
        <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {formError}
        </p>
      )}
      <Field id={`${uid}-company`} label="Company" error={errors.company}>
        <Input
          id={`${uid}-company`}
          autoFocus
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          {...errorProps(`${uid}-company`, errors.company)}
        />
      </Field>
      <Field id={`${uid}-role`} label="Role" error={errors.role}>
        <Input
          id={`${uid}-role`}
          value={role}
          onChange={(e) => setRole(e.target.value)}
          {...errorProps(`${uid}-role`, errors.role)}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`${uid}-source`} label="Source" error={errors.source}>
          <NativeSelect id={`${uid}-source`} value={source} onChange={(e) => setSource(e.target.value as Source)}>
            {SOURCES.map((s) => (
              <option key={s} value={s}>
                {SOURCE_LABELS[s]}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field id={`${uid}-date`} label="Date applied" error={errors.dateApplied}>
          <Input
            id={`${uid}-date`}
            type="date"
            value={dateApplied}
            onChange={(e) => setDateApplied(e.target.value)}
            {...errorProps(`${uid}-date`, errors.dateApplied)}
          />
        </Field>
      </div>
      <DialogFooter className="pt-2">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={create.isPending}>
          Add
        </Button>
      </DialogFooter>
    </form>
  );
}
