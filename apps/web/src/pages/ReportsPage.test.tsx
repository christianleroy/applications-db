import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { addDays, createApplication, todayIso } from '@applications-db/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ClientProvider } from '../data/ClientProvider';
import { MemoryClient } from '../data/memoryClient';
import { ReportsPage } from './ReportsPage';

vi.mock('../components/EChart', () => ({
  EChart: ({ ariaLabel, onReady }: { ariaLabel: string; onReady?: (i: unknown) => void }) => {
    // Fake instance whose export always fails (zero size).
    useEffect(() => {
      onReady?.({ getDataURL: () => 'data:image/svg+xml;charset=UTF-8,x', getWidth: () => 0, getHeight: () => 0 });
    }, [onReady]);
    return <div data-testid="chart">{ariaLabel}</div>;
  },
}));

function setup(daysAgo: number[], url = '/reports') {
  const apps = daysAgo.map((d, i) =>
    createApplication(
      { company: `Co${i}`, role: 'Engineer', source: 'linkedin', dateApplied: addDays(todayIso(), -d), contacts: [] },
      () => crypto.randomUUID(),
      '2026-01-01T00:00:00.000Z',
    ),
  );
  const client = new MemoryClient(apps);
  const report = vi.spyOn(client, 'report');
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <ClientProvider client={client}>
        <MemoryRouter initialEntries={[url]}>
          <ReportsPage />
        </MemoryRouter>
      </ClientProvider>
    </QueryClientProvider>,
  );
  return { report };
}

afterEach(() => vi.restoreAllMocks());

describe('ReportsPage', () => {
  it('requests the last 90 days by default and shows six charts with download buttons', async () => {
    const { report } = setup([1, 2]);
    await screen.findByText(/2 applications, response rate/);
    expect(report).toHaveBeenCalledWith({ from: addDays(todayIso(), -89), to: todayIso() });
    expect(screen.getAllByTestId('chart')).toHaveLength(6);
    expect(screen.getAllByRole('button', { name: /Download PNG/ })).toHaveLength(6);
  });

  it('honours from and to in the URL', async () => {
    const { report } = setup([1], '/reports?from=2026-01-01&to=2026-01-31');
    await screen.findByText('No applications in this date range');
    expect(report).toHaveBeenCalledWith({ from: '2026-01-01', to: '2026-01-31' });
  });

  it('shows one empty state instead of charts when the range has no applications', async () => {
    setup([200]);
    expect(await screen.findByText('No applications in this date range')).toBeInTheDocument();
    expect(screen.queryAllByTestId('chart')).toHaveLength(0);
  });

  it('prints via window.print', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => {});
    setup([1]);
    await userEvent.click(await screen.findByRole('button', { name: 'Print / Save as PDF' }));
    expect(print).toHaveBeenCalledOnce();
  });

  it('shows an alert when exporting a chart fails', async () => {
    setup([1]);
    expect(screen.queryByRole('alert')).toBeNull();
    const [first] = await screen.findAllByRole('button', { name: /Download PNG/ });
    await userEvent.click(first!);
    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't export the chart image.");
  });
});
