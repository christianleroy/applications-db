import type { ReactNode } from 'react';

export const inputClass =
  'block w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm focus:border-blue-600 focus:outline-none';

type FieldProps = { id: string; label: string; error?: string; children: ReactNode };

/** A labelled form control with its validation message rendered next to it. */
export function Field({ id, label, error, children }: FieldProps) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-slate-700">
        {label}
      </label>
      {children}
      {error && (
        <p id={`${id}-error`} className="mt-1 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

/** Props linking a control to the error message `Field` renders for it. */
export function errorProps(id: string, error?: string) {
  return error ? { 'aria-invalid': true as const, 'aria-describedby': `${id}-error` } : {};
}
