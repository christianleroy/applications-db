import { useState } from 'react';
import { addDays, todayIso, type DateRange } from '@applications-db/shared';
import { Field, errorProps, inputClass } from './Field';

type Props = { value: DateRange; onChange: (range: DateRange) => void };

const PRESETS: { label: string; range: (today: string) => DateRange }[] = [
  { label: 'Last 30 days', range: (t) => ({ from: addDays(t, -29), to: t }) },
  { label: 'Last 90 days', range: (t) => ({ from: addDays(t, -89), to: t }) },
  { label: 'This year', range: (t) => ({ from: `${t.slice(0, 4)}-01-01`, to: t }) },
];

const same = (a: DateRange, b: DateRange) => a.from === b.from && a.to === b.to;

export function DateRangePicker({ value, onChange }: Props) {
  const [custom, setCustom] = useState(false);
  const [from, setFrom] = useState(value.from);
  const [to, setTo] = useState(value.to);
  const today = todayIso();
  const activePreset = custom ? undefined : PRESETS.find((p) => same(p.range(today), value))?.label;
  const showCustom = custom || activePreset === undefined;
  const inverted = from !== '' && to !== '' && from > to;

  function update(nextFrom: string, nextTo: string) {
    setFrom(nextFrom);
    setTo(nextTo);
    if (nextFrom !== '' && nextTo !== '' && nextFrom <= nextTo) onChange({ from: nextFrom, to: nextTo });
  }

  const btn = (active: boolean) =>
    `rounded border px-3 py-1.5 text-sm ${active ? 'border-blue-700 bg-blue-50 text-blue-800' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Date range">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            aria-pressed={activePreset === p.label}
            className={btn(activePreset === p.label)}
            onClick={() => {
              setCustom(false);
              const r = p.range(todayIso());
              setFrom(r.from);
              setTo(r.to);
              onChange(r);
            }}
          >
            {p.label}
          </button>
        ))}
        <button
          type="button"
          aria-pressed={showCustom}
          className={btn(showCustom)}
          onClick={() => {
            setCustom(true);
            setFrom(value.from);
            setTo(value.to);
          }}
        >
          Custom
        </button>
      </div>
      {showCustom && (
        <div className="flex flex-wrap items-start gap-3">
          <Field id="range-from" label="Start date">
            <input
              id="range-from"
              type="date"
              className={inputClass}
              value={from}
              onChange={(e) => update(e.target.value, to)}
            />
          </Field>
          <Field id="range-to" label="End date" error={inverted ? 'Start date must be on or before end date' : undefined}>
            <input
              id="range-to"
              type="date"
              className={inputClass}
              value={to}
              onChange={(e) => update(from, e.target.value)}
              {...errorProps('range-to', inverted ? 'x' : undefined)}
            />
          </Field>
        </div>
      )}
    </div>
  );
}
