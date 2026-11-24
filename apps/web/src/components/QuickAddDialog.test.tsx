import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { todayIso } from '@applications-db/shared';
import { describe, expect, it, vi } from 'vitest';
import { ClientProvider } from '../data/ClientProvider';
import { MemoryClient } from '../data/memoryClient';
import { QuickAddDialog } from './QuickAddDialog';

const defaultQuery = { sort: 'dateApplied:desc', page: 1, pageSize: 25 } as const;

function Where() {
  return <div data-testid="where">{useLocation().pathname}</div>;
}

function setup(open = true, onClose = vi.fn()) {
  const client = new MemoryClient([]);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <ClientProvider client={client}>
        <MemoryRouter>
          <QuickAddDialog open={open} onClose={onClose} />
          <Routes>
            <Route path="*" element={<Where />} />
          </Routes>
        </MemoryRouter>
      </ClientProvider>
    </QueryClientProvider>,
  );
  return { client, onClose };
}

describe('QuickAddDialog', () => {
  it('renders nothing when closed', () => {
    setup(false);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('defaults the date applied to today', () => {
    setup();
    expect(screen.getByLabelText('Date applied')).toHaveValue(todayIso());
  });

  it('shows a required error and creates nothing when company is empty', async () => {
    const user = userEvent.setup();
    const { client } = setup();
    await user.type(screen.getByLabelText('Role'), 'Engineer');
    await user.click(screen.getByRole('button', { name: 'Add' }));
    expect(await screen.findByText('Company is required')).toBeInTheDocument();
    expect((await client.list(defaultQuery)).total).toBe(0);
  });

  it('creates an application, closes and navigates to it', async () => {
    const user = userEvent.setup();
    const { client, onClose } = setup();
    await user.type(screen.getByLabelText('Company'), 'Acme');
    await user.type(screen.getByLabelText('Role'), 'Engineer');
    await user.click(screen.getByRole('button', { name: 'Add' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const page = await client.list(defaultQuery);
    expect(page.total).toBe(1);
    // onClose runs before navigate() in the component, so the location updates a render later.
    await waitFor(() =>
      expect(screen.getByTestId('where')).toHaveTextContent(`/applications/${page.items[0]!.id}`),
    );
  });

  it('closes on Escape and returns focus to the "Add application" trigger', async () => {
    const user = userEvent.setup();
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <QuickAddDialog
          open={open}
          onClose={() => setOpen(false)}
          trigger={
            <button type="button" onClick={() => setOpen(true)}>
              Add application
            </button>
          }
        />
      );
    }
    render(
      <QueryClientProvider client={queryClient}>
        <ClientProvider client={new MemoryClient([])}>
          <MemoryRouter>
            <Harness />
          </MemoryRouter>
        </ClientProvider>
      </QueryClientProvider>,
    );
    const trigger = screen.getByRole('button', { name: 'Add application' });
    await user.click(trigger);
    expect(await screen.findByRole('dialog', { name: 'Add application' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(trigger).toHaveFocus();
  });

  it('closes on Escape', async () => {
    const user = userEvent.setup();
    const { onClose } = setup();
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });
});
