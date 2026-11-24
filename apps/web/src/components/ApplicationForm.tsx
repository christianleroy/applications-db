import { useId, useState, type Dispatch, type FormEvent, type SetStateAction } from 'react';
import { PlusIcon } from 'lucide-react';
import {
  SALARY_PERIODS,
  SOURCES,
  UpdateApplicationInputSchema,
  WORK_MODES,
  type Application,
  type Contact,
  type Salary,
  type SalaryPeriod,
  type Source,
  type UpdateApplicationInput,
  type WorkMode,
} from '@applications-db/shared';
import { useUpdateApplication } from '../data/hooks';
import { SOURCE_LABELS, WORK_MODE_LABELS } from '../lib/labels';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { Field, errorProps } from './Field';

type Props = { initial: Application; onSaved: (app: Application) => void; onEdit?: () => void };

type ContactDraft = { name: string; role: string; email: string; phone: string; notes: string };

const CONTACT_FIELDS = ['name', 'role', 'email', 'phone', 'notes'] as const;

const toDraft = (c: Contact): ContactDraft => ({
  name: c.name,
  role: c.role ?? '',
  email: c.email ?? '',
  phone: c.phone ?? '',
  notes: c.notes ?? '',
});

const blankContact = (): ContactDraft => ({ name: '', role: '', email: '', phone: '', notes: '' });

const isBlank = (d: ContactDraft) => CONTACT_FIELDS.every((f) => d[f].trim() === '');

function toContact(d: ContactDraft): Contact {
  const contact: Contact = { name: d.name.trim() };
  for (const f of CONTACT_FIELDS) {
    if (f !== 'name' && d[f].trim() !== '') contact[f] = d[f].trim();
  }
  return contact;
}

const numberOrUndefined = (s: string) => (s.trim() === '' ? undefined : Number(s));

/** Empty text becomes null (clear) when the stored value existed, otherwise stays unchanged (undefined). */
function textPatch(value: string, stored: string | undefined): string | null | undefined {
  const next = value.trim();
  if ((stored ?? '') === next) return undefined;
  return next === '' ? null : next;
}

function issueKey(path: PropertyKey[]): string {
  return path.map(String).join('.');
}

/**
 * A field draft that follows `source` until the user edits it. Once touched it keeps the user's
 * input when `source` changes, and resumes following once `source` catches up (e.g. after a save).
 */
function useDraft<T>(source: T, onEdit?: () => void): [T, Dispatch<SetStateAction<T>>] {
  const [state, setState] = useState({ value: source, touched: false });
  const key = JSON.stringify(source);
  const [prevKey, setPrevKey] = useState(key);
  if (key !== prevKey) {
    setPrevKey(key);
    if (!state.touched || JSON.stringify(state.value) === key) setState({ value: source, touched: false });
  }
  return [
    state.value,
    (next) => {
      setState((s) => ({ value: typeof next === 'function' ? (next as (prev: T) => T)(s.value) : next, touched: true }));
      onEdit?.();
    },
  ];
}

export function ApplicationForm({ initial, onSaved, onEdit }: Props) {
  const uid = useId();
  const update = useUpdateApplication();
  const [company, setCompany] = useDraft(initial.company, onEdit);
  const [role, setRole] = useDraft(initial.role, onEdit);
  const [postingUrl, setPostingUrl] = useDraft(initial.postingUrl ?? '', onEdit);
  const [location, setLocation] = useDraft(initial.location ?? '', onEdit);
  const [workMode, setWorkMode] = useDraft<WorkMode | ''>(initial.workMode ?? '', onEdit);
  const [salaryMin, setSalaryMin] = useDraft(initial.salary?.min?.toString() ?? '', onEdit);
  const [salaryMax, setSalaryMax] = useDraft(initial.salary?.max?.toString() ?? '', onEdit);
  const [currency, setCurrency] = useDraft(initial.salary?.currency ?? 'USD', onEdit);
  const [period, setPeriod] = useDraft<SalaryPeriod>(initial.salary?.period ?? 'year', onEdit);
  const [source, setSource] = useDraft(initial.source, onEdit);
  const [dateApplied, setDateApplied] = useDraft(initial.dateApplied, onEdit);
  const [followUpDate, setFollowUpDate] = useDraft(initial.followUpDate ?? '', onEdit);
  const [contacts, setContacts] = useDraft<ContactDraft[]>(initial.contacts.map(toDraft), onEdit);
  const [notes, setNotes] = useDraft(initial.notes ?? '', onEdit);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const id = (name: string) => `${uid}-${name}`;

  /** `contactRows[i]` is the draft row index of the i-th submitted (non-blank) contact. */
  function buildPatch(): { patch: UpdateApplicationInput; contactRows: number[] } {
    const patch: UpdateApplicationInput = {};
    if (company.trim() !== initial.company) patch.company = company;
    if (role.trim() !== initial.role) patch.role = role;
    if (source !== initial.source) patch.source = source;
    if (dateApplied !== initial.dateApplied) patch.dateApplied = dateApplied;

    const url = textPatch(postingUrl, initial.postingUrl);
    if (url !== undefined) patch.postingUrl = url;
    const loc = textPatch(location, initial.location);
    if (loc !== undefined) patch.location = loc;
    const follow = textPatch(followUpDate, initial.followUpDate);
    if (follow !== undefined) patch.followUpDate = follow;
    const note = textPatch(notes, initial.notes);
    if (note !== undefined) patch.notes = note;
    if (workMode !== (initial.workMode ?? '')) patch.workMode = workMode === '' ? null : workMode;

    const min = numberOrUndefined(salaryMin);
    const max = numberOrUndefined(salaryMax);
    const nextSalary: Salary | null =
      min === undefined && max === undefined
        ? null
        : { ...(min !== undefined && { min }), ...(max !== undefined && { max }), currency: currency.trim().toUpperCase(), period };
    if (JSON.stringify(nextSalary) !== JSON.stringify(initial.salary ?? null)) patch.salary = nextSalary;

    const contactRows = contacts.flatMap((c, i) => (isBlank(c) ? [] : [i]));
    const nextContacts = contactRows.map((i) => toContact(contacts[i]!));
    if (JSON.stringify(nextContacts) !== JSON.stringify(initial.contacts)) patch.contacts = nextContacts;
    return { patch, contactRows };
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const { patch, contactRows } = buildPatch();
    const parsed = UpdateApplicationInputSchema.safeParse(patch);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const path = [...issue.path];
        // Issue indexes refer to the filtered contacts array; map back to the visible row.
        if (path[0] === 'contacts' && typeof path[1] === 'number') path[1] = contactRows[path[1]] ?? path[1];
        next[issueKey(path)] ??= issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    if (Object.keys(parsed.data).length === 0) {
      onSaved(initial);
      return;
    }
    try {
      onSaved(await update.mutateAsync({ id: initial.id, patch: parsed.data }));
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save the application');
    }
  }

  const setContact = (index: number, field: keyof ContactDraft, value: string) =>
    setContacts((cs) => cs.map((c, i) => (i === index ? { ...c, [field]: value } : c)));

  return (
    <form onSubmit={submit} noValidate className="space-y-8">
      {formError && (
        <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {formError}
        </p>
      )}

      <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
        <Field id={id('company')} label="Company" error={errors.company}>
          <Input id={id('company')} value={company} onChange={(e) => setCompany(e.target.value)} {...errorProps(id('company'), errors.company)} />
        </Field>
        <Field id={id('role')} label="Role" error={errors.role}>
          <Input id={id('role')} value={role} onChange={(e) => setRole(e.target.value)} {...errorProps(id('role'), errors.role)} />
        </Field>
        <Field id={id('url')} label="Posting URL" error={errors.postingUrl}>
          <Input id={id('url')} value={postingUrl} onChange={(e) => setPostingUrl(e.target.value)} {...errorProps(id('url'), errors.postingUrl)} />
        </Field>
        <Field id={id('location')} label="Location" error={errors.location}>
          <Input id={id('location')} value={location} onChange={(e) => setLocation(e.target.value)} {...errorProps(id('location'), errors.location)} />
        </Field>
        <Field id={id('workMode')} label="Work mode" error={errors.workMode}>
          <NativeSelect id={id('workMode')} value={workMode} onChange={(e) => setWorkMode(e.target.value as WorkMode | '')}>
            <option value="">Not set</option>
            {WORK_MODES.map((m) => (
              <option key={m} value={m}>
                {WORK_MODE_LABELS[m]}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field id={id('source')} label="Source" error={errors.source}>
          <NativeSelect id={id('source')} value={source} onChange={(e) => setSource(e.target.value as Source)}>
            {SOURCES.map((s) => (
              <option key={s} value={s}>
                {SOURCE_LABELS[s]}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field id={id('dateApplied')} label="Date applied" error={errors.dateApplied}>
          <Input id={id('dateApplied')} type="date" value={dateApplied} onChange={(e) => setDateApplied(e.target.value)} {...errorProps(id('dateApplied'), errors.dateApplied)} />
        </Field>
        <Field id={id('followUp')} label="Follow-up date" error={errors.followUpDate}>
          <Input id={id('followUp')} type="date" value={followUpDate} onChange={(e) => setFollowUpDate(e.target.value)} {...errorProps(id('followUp'), errors.followUpDate)} />
        </Field>
      </div>

      <div className="border-t pt-6">
        <fieldset className="min-w-0 space-y-4">
          <legend className="text-sm font-semibold">Salary</legend>
          <div className="grid gap-x-6 gap-y-5 sm:grid-cols-4">
            <Field id={id('salaryMin')} label="Salary min" error={errors['salary.min']}>
              <Input id={id('salaryMin')} type="number" min="0" value={salaryMin} onChange={(e) => setSalaryMin(e.target.value)} {...errorProps(id('salaryMin'), errors['salary.min'])} />
            </Field>
            <Field id={id('salaryMax')} label="Salary max" error={errors['salary.max']}>
              <Input id={id('salaryMax')} type="number" min="0" value={salaryMax} onChange={(e) => setSalaryMax(e.target.value)} {...errorProps(id('salaryMax'), errors['salary.max'])} />
            </Field>
            <Field id={id('currency')} label="Currency" error={errors['salary.currency'] && 'Use a 3-letter currency code'}>
              <Input id={id('currency')} maxLength={3} value={currency} onChange={(e) => setCurrency(e.target.value)} {...errorProps(id('currency'), errors['salary.currency'])} />
            </Field>
            <Field id={id('period')} label="Period" error={errors['salary.period']}>
              <NativeSelect id={id('period')} value={period} onChange={(e) => setPeriod(e.target.value as SalaryPeriod)}>
                {SALARY_PERIODS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          </div>
          {errors.salary && <p className="text-sm text-destructive">{errors.salary}</p>}
        </fieldset>
      </div>

      <div className="border-t pt-6">
        <fieldset className="min-w-0 space-y-4">
          <legend className="text-sm font-semibold">Contacts</legend>
          {contacts.map((c, i) => (
            <div key={i} className="grid gap-x-6 gap-y-4 rounded-md border bg-muted/30 p-4 sm:grid-cols-2">
              {CONTACT_FIELDS.map((f) => {
                const fieldId = id(`contact-${i}-${f}`);
                const error = errors[`contacts.${i}.${f}`];
                return (
                  <Field key={f} id={fieldId} label={`Contact ${i + 1} ${f}`} error={error}>
                    <Input id={fieldId} value={c[f]} onChange={(e) => setContact(i, f, e.target.value)} {...errorProps(fieldId, error)} />
                  </Field>
                );
              })}
              <div className="flex items-end justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={`Remove contact ${i + 1}`}
                  onClick={() => setContacts((cs) => cs.filter((_, j) => j !== i))}
                  className="text-destructive hover:bg-destructive/5 hover:text-destructive"
                >
                  Remove
                </Button>
              </div>
            </div>
          ))}
          {errors.contacts && <p className="text-sm text-destructive">{errors.contacts}</p>}
          <Button type="button" variant="outline" size="sm" onClick={() => setContacts((cs) => [...cs, blankContact()])}>
            <PlusIcon aria-hidden="true" />
            Add contact
          </Button>
        </fieldset>
      </div>

      <Field id={id('notes')} label="Notes" error={errors.notes} className="border-t pt-6">
        <Textarea id={id('notes')} rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>

      <div className="flex justify-end">
        <Button type="submit" disabled={update.isPending}>
          Save
        </Button>
      </div>
    </form>
  );
}
