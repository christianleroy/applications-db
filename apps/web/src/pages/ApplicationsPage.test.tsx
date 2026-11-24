import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { addStatusEntry, createApplication, type Application } from '@applications-db/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ClientProvider } from '../data/ClientProvider';
import { MemoryClient } from '../data/memoryClient';
import { ApplicationsPage } from './ApplicationsPage';

const NOW = '2026-11-01T00:00:00.000Z';
const newId = () => crypto.randomUUID();

function make(company: string, dateApplied: string, interview = false): Application {
  const app = createApplication({ company, role: 'Engineer', source: 'linkedin', dateApplied, contacts: [] }, newId, NOW);
  return interview ? addStatusEntry(app, { status: 'interview', date: '2026-11-10' }, newId, NOW) : app;
}

function Where() {
  const l = useLocation();
  return <div data-testid="where">{l.pathname + l.search}</div>;
}

function setup(path = '/applications') {
  const client = new MemoryClient([make('Acme', '2026-10-01'), make('Beta Corp', '2026-10-02', true), make('Gamma', '2026-10-03')]);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <ClientProvider client={client}>
        <MemoryRouter initialEntries={[path]}>
          <Where />
          <Routes>
            <Route path="/applications" element={<ApplicationsPage />} />
            <Route path="/applications/:id" element={<div>detail page</div>} />
          </Routes>
        </MemoryRouter>
      </ClientProvider>
    </QueryClientProvider>,
  );
}

const rowsText = () =>
  screen
    .getAllByRole('row')
    .slice(1)
    .map((r) => r.textContent ?? '');

afterEach(() => vi.useRealTimers());

describe('ApplicationsPage', () => {
  it('lists all applications with the last change column', async () => {
    setup();
    expect(await screen.findByText('Acme')).toBeInTheDocument();
    expect(rowsText()).toHaveLength(3);
    expect(screen.getByText('Nov 10, 2026')).toBeInTheDocument();
  });

  it('debounces search by 250 ms, filters rows and writes q to the URL', async () => {
    setup();
    await screen.findByText('Acme');
    vi.useFakeTimers();
    // user-event awaits real timers, which would hang under fake ones; fireEvent is synchronous.
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search' }), { target: { value: 'acme' } });
    expect(screen.getByTestId('where')).not.toHaveTextContent('q=acme');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });
    // Let the query started by the URL change settle before returning to real timers.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });
    vi.useRealTimers();
    expect(screen.getByTestId('where')).toHaveTextContent('q=acme');
    await vi.waitFor(() => expect(rowsText()).toHaveLength(1));
    expect(rowsText()[0]).toContain('Acme');
  });

  it('filters by status with repeated URL params', async () => {
    const user = userEvent.setup();
    setup();
    await screen.findByText('Acme');
    await user.click(within(screen.getByRole('group', { name: 'Status' })).getByLabelText('Interview'));
    await vi.waitFor(() => expect(rowsText()).toHaveLength(1));
    expect(rowsText()[0]).toContain('Beta Corp');
    expect(screen.getByTestId('where')).toHaveTextContent('status=interview');
  });

  it('reads filters from the URL and ignores invalid values', async () => {
    setup('/applications?status=interview&status=bogus&page=abc&sort=nope');
    expect(await screen.findByText('Beta Corp')).toBeInTheDocument();
    expect(rowsText()).toHaveLength(1);
  });

  it('shows the empty state and Clear filters restores all rows', async () => {
    const user = userEvent.setup();
    setup('/applications?q=zzzz');
    expect(await screen.findByText('No applications match these filters')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(await screen.findByText('Acme')).toBeInTheDocument();
    expect(rowsText()).toHaveLength(3);
    expect(screen.getByTestId('where')).toHaveTextContent(/^\/applications$/);
  });

  it('navigates to the detail page on row click', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(await screen.findByText('Gamma'));
    expect(await screen.findByText('detail page')).toBeInTheDocument();
  });
});
