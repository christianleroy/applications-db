import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { addDays, createApplication, todayIso } from '@applications-db/shared';
import { describe, expect, it, vi } from 'vitest';
import { ClientProvider } from '../data/ClientProvider';
import { MemoryClient } from '../data/memoryClient';
import { StatisticsPage } from './StatisticsPage';

vi.mock('../components/EChart', () => ({
  EChart: ({ ariaLabel }: { ariaLabel: string }) => <div data-testid="chart">{ariaLabel}</div>,
}));

function setup(count: number) {
  const apps = Array.from({ length: count }, (_, i) =>
    createApplication(
      { company: `Co${i}`, role: 'Engineer', source: 'linkedin', dateApplied: addDays(todayIso(), -i), contacts: [] },
      () => crypto.randomUUID(),
      '2026-01-01T00:00:00.000Z',
    ),
  );
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <ClientProvider client={new MemoryClient(apps)}>
        <StatisticsPage />
      </ClientProvider>
    </QueryClientProvider>,
  );
}

const tile = (name: string) => screen.getByText(name).parentElement!;

describe('StatisticsPage', () => {
  it('shows em dashes and no charts with no applications, never NaN', async () => {
    setup(0);
    await screen.findByText('Total applications');
    expect(within(tile('Response rate')).getByText('—')).toBeInTheDocument();
    expect(within(tile('Median days to first response')).getByText('—')).toBeInTheDocument();
    expect(screen.queryAllByTestId('chart')).toHaveLength(0);
    expect(document.body).not.toHaveTextContent('NaN');
  });

  it('renders totals and six charts', async () => {
    setup(2);
    await screen.findByText('Total applications');
    expect(within(tile('Total applications')).getByText('2')).toBeInTheDocument();
    expect(screen.getAllByTestId('chart')).toHaveLength(6);
  });
});
