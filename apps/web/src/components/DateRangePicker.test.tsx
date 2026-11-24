import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DateRangePicker } from './DateRangePicker';

const VALUE = { from: '2026-01-01', to: '2026-02-01' };

describe('DateRangePicker', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-23T12:00:00'));
  });
  afterEach(() => vi.useRealTimers());

  it('emits the last 30 days ending today', async () => {
    const onChange = vi.fn();
    render(<DateRangePicker value={VALUE} onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Last 30 days' }));
    expect(onChange).toHaveBeenCalledWith({ from: '2026-10-25', to: '2026-11-23' });
  });

  it('emits last 90 days and this year', async () => {
    const onChange = vi.fn();
    render(<DateRangePicker value={VALUE} onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Last 90 days' }));
    expect(onChange).toHaveBeenLastCalledWith({ from: '2026-08-26', to: '2026-11-23' });
    await userEvent.click(screen.getByRole('button', { name: 'This year' }));
    expect(onChange).toHaveBeenLastCalledWith({ from: '2026-01-01', to: '2026-11-23' });
  });

  it('shows an error and emits nothing for an inverted custom range', async () => {
    const onChange = vi.fn();
    render(<DateRangePicker value={VALUE} onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Custom' }));
    const to = screen.getByLabelText('End date');
    await userEvent.clear(to);
    await userEvent.type(to, '2025-12-31');
    expect(screen.getByText('Start date must be on or before end date')).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('emits a valid custom range', async () => {
    const onChange = vi.fn();
    render(<DateRangePicker value={VALUE} onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Custom' }));
    const to = screen.getByLabelText('End date');
    await userEvent.clear(to);
    await userEvent.type(to, '2026-03-05');
    expect(onChange).toHaveBeenLastCalledWith({ from: '2026-01-01', to: '2026-03-05' });
  });
});
