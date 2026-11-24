import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { addDays, addStatusEntry, createApplication, todayIso, type Application } from '@applications-db/shared';
import { describe, expect, it } from 'vitest';
import { ClientProvider } from '../data/ClientProvider';
import { MemoryClient } from '../data/memoryClient';
import { DashboardPage } from './DashboardPage';

const newId = () => crypto.randomUUID();
const NOW = '2026-01-01T00:00:00.000Z';

function app(company: string, daysAgo: number, extra: Partial<Application> = {}): Application {
  const base = createApplication(
    { company, role: 'Engineer', source: 'linkedin', dateApplied: addDays(todayIso(), -daysAgo), contacts: [] },
    () => crypto.randomUUID(),
    NOW,
  );
  return { ...base, ...extra };
}

function setup(apps: Application[]) {
  const client = new MemoryClient(apps);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <ClientProvider client={client}>
        <MemoryRouter>
          <DashboardPage />
        </MemoryRouter>
      </ClientProvider>
    </QueryClientProvider>,
  );
}

const tile = (name: string) => screen.getByText(name).parentElement!;

describe('DashboardPage', () => {
  it('shows tile counts for a known fixture', async () => {
    const interview = addStatusEntry(app('Beta', 10), { status: 'interview', date: addDays(todayIso(), -2) }, newId, NOW);
    const offer = addStatusEntry(app('Gamma', 12), { status: 'offer', date: addDays(todayIso(), -1) }, newId, NOW);
    setup([app('Alpha', 1), interview, offer]);
    await screen.findByText('Active');
    expect(within(tile('Active')).getByText('3')).toBeInTheDocument();
    expect(within(tile('In interview')).getByText('1')).toBeInTheDocument();
    expect(within(tile('Offers')).getByText('1')).toBeInTheDocument();
    expect(within(tile('Response rate')).getByText('67%')).toBeInTheDocument();
  });

  it('shows an em dash response rate and empty texts with no applications', async () => {
    setup([]);
    await screen.findByText('Response rate');
    expect(within(tile('Response rate')).getByText('—')).toBeInTheDocument();
    expect(screen.getByText('No follow-ups due')).toBeInTheDocument();
    expect(screen.getByText('Nothing stale')).toBeInTheDocument();
    expect(screen.getByText('No recent activity')).toBeInTheDocument();
  });

  it('lists follow-ups due with a link to the detail page', async () => {
    const a = app('Delta', 3, { followUpDate: addDays(todayIso(), -1) });
    setup([a]);
    const section = (await screen.findByRole('heading', { name: 'Follow-ups due' })).closest('section')!;
    expect(within(section).getByRole('link', { name: /Delta/ })).toHaveAttribute('href', `/applications/${a.id}`);
  });

  it('Mark ghosted moves a stale application out of the Stale list', async () => {
    const user = userEvent.setup();
    setup([app('Stalecorp', 30)]);
    const section = (await screen.findByRole('heading', { name: /Stale/ })).closest('section')!;
    expect(within(section).getByRole('link', { name: /Stalecorp/ })).toBeInTheDocument();
    await user.click(within(section).getByRole('button', { name: /Mark ghosted/ }));
    expect(await within(section).findByText('Nothing stale')).toBeInTheDocument();
    expect(within(section).queryByRole('link', { name: /Stalecorp/ })).toBeNull();
  });
});
