import { useId, useState, type FormEvent } from 'react';
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
import { Field, errorProps, inputClass } from './Field';

type Props = { initial: Application; onSaved: (app: Application) => void };

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

export function ApplicationForm({ initial, onSaved }: Props) {
  const uid = useId();
  const update = useUpdateApplication();
  const [company, setCompany] = useState(initial.company);
  const [role, setRole] = useState(initial.role);
  const [postingUrl, setPostingUrl] = useState(initial.postingUrl ?? '');
  const [location, setLocation] = useState(initial.location ?? '');
  const [workMode, setWorkMode] = useState<WorkMode | ''>(initial.workMode ?? '');
  const [salaryMin, setSalaryMin] = useState(initial.salary?.min?.toString() ?? '');
  const [salaryMax, setSalaryMax] = useState(initial.salary?.max?.toString() ?? '');
  const [currency, setCurrency] = useState(initial.salary?.currency ?? 'USD');
  const [period, setPeriod] = useState<SalaryPeriod>(initial.salary?.period ?? 'year');
  const [source, setSource] = useState<Source>(initial.source);
  const [dateApplied, setDateApplied] = useState(initial.dateApplied);
  const [followUpDate, setFollowUpDate] = useState(initial.followUpDate ?? '');
  const [contacts, setContacts] = useState<ContactDraft[]>(initial.contacts.map(toDraft));
  const [notes, setNotes] = useState(initial.notes ?? '');
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
    <form onSubmit={submit} noValidate className="space-y-4">
      {formError && (
        <p role="alert" className="rounded bg-red-50 px-3 py-2 text-sm text-red-800">
          {formError}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={id('company')} label="Company" error={errors.company}>
          <input id={id('company')} className={inputClass} value={company} onChange={(e) => setCompany(e.target.value)} {...errorProps(id('company'), errors.company)} />
        </Field>
        <Field id={id('role')} label="Role" error={errors.role}>
          <input id={id('role')} className={inputClass} value={role} onChange={(e) => setRole(e.target.value)} {...errorProps(id('role'), errors.role)} />
        </Field>
        <Field id={id('url')} label="Posting URL" error={errors.postingUrl}>
          <input id={id('url')} className={inputClass} value={postingUrl} onChange={(e) => setPostingUrl(e.target.value)} {...errorProps(id('url'), errors.postingUrl)} />
        </Field>
        <Field id={id('location')} label="Location" error={errors.location}>
          <input id={id('location')} className={inputClass} value={location} onChange={(e) => setLocation(e.target.value)} {...errorProps(id('location'), errors.location)} />
        </Field>
        <Field id={id('workMode')} label="Work mode" error={errors.workMode}>
          <select id={id('workMode')} className={inputClass} value={workMode} onChange={(e) => setWorkMode(e.target.value as WorkMode | '')}>
            <option value="">Not set</option>
            {WORK_MODES.map((m) => (
              <option key={m} value={m}>
                {WORK_MODE_LABELS[m]}
              </option>
            ))}
          </select>
        </Field>
        <Field id={id('source')} label="Source" error={errors.source}>
          <select id={id('source')} className={inputClass} value={source} onChange={(e) => setSource(e.target.value as Source)}>
            {SOURCES.map((s) => (
              <option key={s} value={s}>
                {SOURCE_LABELS[s]}
              </option>
            ))}
          </select>
        </Field>
        <Field id={id('dateApplied')} label="Date applied" error={errors.dateApplied}>
          <input id={id('dateApplied')} type="date" className={inputClass} value={dateApplied} onChange={(e) => setDateApplied(e.target.value)} {...errorProps(id('dateApplied'), errors.dateApplied)} />
        </Field>
        <Field id={id('followUp')} label="Follow-up date" error={errors.followUpDate}>
          <input id={id('followUp')} type="date" className={inputClass} value={followUpDate} onChange={(e) => setFollowUpDate(e.target.value)} {...errorProps(id('followUp'), errors.followUpDate)} />
        </Field>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-slate-700">Salary</legend>
        <div className="grid gap-4 sm:grid-cols-4">
          <Field id={id('salaryMin')} label="Salary min" error={errors['salary.min']}>
            <input id={id('salaryMin')} type="number" min="0" className={inputClass} value={salaryMin} onChange={(e) => setSalaryMin(e.target.value)} {...errorProps(id('salaryMin'), errors['salary.min'])} />
          </Field>
          <Field id={id('salaryMax')} label="Salary max" error={errors['salary.max']}>
            <input id={id('salaryMax')} type="number" min="0" className={inputClass} value={salaryMax} onChange={(e) => setSalaryMax(e.target.value)} {...errorProps(id('salaryMax'), errors['salary.max'])} />
          </Field>
          <Field id={id('currency')} label="Currency" error={errors['salary.currency'] && 'Use a 3-letter currency code'}>
            <input id={id('currency')} maxLength={3} className={inputClass} value={currency} onChange={(e) => setCurrency(e.target.value)} {...errorProps(id('currency'), errors['salary.currency'])} />
          </Field>
          <Field id={id('period')} label="Period" error={errors['salary.period']}>
            <select id={id('period')} className={inputClass} value={period} onChange={(e) => setPeriod(e.target.value as SalaryPeriod)}>
              {SALARY_PERIODS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </Field>
        </div>
        {errors.salary && <p className="text-sm text-red-700">{errors.salary}</p>}
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium text-slate-700">Contacts</legend>
        {contacts.map((c, i) => (
          <div key={i} className="grid gap-3 rounded border border-slate-200 p-3 sm:grid-cols-2">
            {CONTACT_FIELDS.map((f) => {
              const fieldId = id(`contact-${i}-${f}`);
              const error = errors[`contacts.${i}.${f}`];
              return (
                <Field key={f} id={fieldId} label={`Contact ${i + 1} ${f}`} error={error}>
                  <input id={fieldId} className={inputClass} value={c[f]} onChange={(e) => setContact(i, f, e.target.value)} {...errorProps(fieldId, error)} />
                </Field>
              );
            })}
            <div className="self-end">
              <button
                type="button"
                aria-label={`Remove contact ${i + 1}`}
                onClick={() => setContacts((cs) => cs.filter((_, j) => j !== i))}
                className="rounded border border-slate-300 px-3 py-1.5 text-sm"
              >
                Remove
              </button>
            </div>
          </div>
        ))}
        {errors.contacts && <p className="text-sm text-red-700">{errors.contacts}</p>}
        <button type="button" onClick={() => setContacts((cs) => [...cs, blankContact()])} className="rounded border border-slate-300 px-3 py-1.5 text-sm">
          Add contact
        </button>
      </fieldset>

      <Field id={id('notes')} label="Notes" error={errors.notes}>
        <textarea id={id('notes')} rows={4} className={inputClass} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>

      <div className="flex justify-end">
        <button type="submit" disabled={update.isPending} className="rounded bg-blue-700 px-4 py-1.5 text-sm text-white disabled:opacity-60">
          Save
        </button>
      </div>
    </form>
  );
}
