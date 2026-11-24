import { useState } from 'react';
import { addDays, todayIso, type DateRange } from '@applications-db/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Field, errorProps } from './Field';

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
    cn(
      'rounded-none not-first:border-l',
      active && 'bg-primary text-primary-foreground hover:bg-primary-hover hover:text-primary-foreground',
    );

  return (
    <div className="space-y-4">
      <div className="inline-flex max-w-full flex-wrap overflow-hidden rounded-md border bg-background" role="group" aria-label="Date range">
        {PRESETS.map((p) => (
          <Button
            key={p.label}
            type="button"
            variant="ghost"
            size="sm"
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
          </Button>
        ))}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-pressed={showCustom}
          className={btn(showCustom)}
          onClick={() => {
            setCustom(true);
            setFrom(value.from);
            setTo(value.to);
          }}
        >
          Custom
        </Button>
      </div>
      {showCustom && (
        <div className="grid max-w-md gap-4 sm:grid-cols-2">
          <Field id="range-from" label="Start date">
            <Input
              id="range-from"
              type="date"
              value={from}
              onChange={(e) => update(e.target.value, to)}
            />
          </Field>
          <Field id="range-to" label="End date" error={inverted ? 'Start date must be on or before end date' : undefined}>
            <Input
              id="range-to"
              type="date"
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
