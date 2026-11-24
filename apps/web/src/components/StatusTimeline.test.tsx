import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createApplication } from '@applications-db/shared';
import { describe, expect, it } from 'vitest';
import { ClientProvider } from '../data/ClientProvider';
import { useApplication } from '../data/hooks';
import { MemoryClient } from '../data/memoryClient';
import { StatusBadge } from './StatusBadge';
import { StatusTimeline } from './StatusTimeline';

const newId = () => crypto.randomUUID();
const app = createApplication(
  { company: 'Acme', role: 'Engineer', source: 'linkedin', dateApplied: '2026-10-10', contacts: [] },
  newId,
  '2026-10-10T00:00:00.000Z',
);

function Harness() {
  const { data } = useApplication(app.id);
  if (!data) return null;
  return (
    <>
      <span data-testid="badge">
        <StatusBadge status={data.status} />
      </span>
      <StatusTimeline application={data} />
    </>
  );
}

function setup() {
  const client = new MemoryClient([app]);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <ClientProvider client={client}>
        <Harness />
      </ClientProvider>
    </QueryClientProvider>,
  );
  return client;
}

describe('StatusTimeline', () => {
  it('has no delete button on the first entry', async () => {
    setup();
    const items = await screen.findAllByRole('listitem');
    expect(items).toHaveLength(1);
    expect(within(items[0]!).queryByRole('button', { name: /delete/i })).toBeNull();
    expect(within(items[0]!).getByRole('button', { name: /edit/i })).toBeInTheDocument();
  });

  it('defaults the new status to the next progress stage', async () => {
    setup();
    await screen.findByRole('list');
    expect(screen.getByLabelText('Status')).toHaveValue('screening');
  });

  it('shows a domain error for a status dated before the application date', async () => {
    const user = userEvent.setup();
    setup();
    await screen.findByRole('list');
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-10-01' } });
    await user.click(screen.getByRole('button', { name: 'Add status' }));
    expect(await screen.findByText("A status can't be dated before the application date.")).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
  });

  it('adds a valid interview entry and updates the badge', async () => {
    const user = userEvent.setup();
    setup();
    await screen.findByRole('list');
    await user.selectOptions(screen.getByLabelText('Status'), 'interview');
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-10-15' } });
    await user.type(screen.getByLabelText('Note'), 'Phone screen');
    await user.click(screen.getByRole('button', { name: 'Add status' }));
    expect(await screen.findByText('Phone screen')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByTestId('badge')).toHaveTextContent('Interview');
  });

  it('edits and deletes a later entry', async () => {
    const user = userEvent.setup();
    setup();
    await screen.findByRole('list');
    await user.click(screen.getByRole('button', { name: 'Add status' }));
    await waitForItems(2);
    const second = screen.getAllByRole('listitem')[1]!;
    await user.click(within(second).getByRole('button', { name: /edit/i }));
    await user.selectOptions(within(second).getByLabelText('Status'), 'rejected');
    await user.click(within(second).getByRole('button', { name: 'Save' }));
    await waitForBadge('Rejected');
    await user.click(within(screen.getAllByRole('listitem')[1]!).getByRole('button', { name: /delete/i }));
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete' }));
    await waitForItems(1);
    expect(screen.getByTestId('badge')).toHaveTextContent('Applied');
  });

  it('asks for confirmation before deleting an entry, and Escape cancels it', async () => {
    const user = userEvent.setup();
    const client = setup();
    await screen.findByRole('list');
    await user.click(screen.getByRole('button', { name: 'Add status' }));
    await waitForItems(2);
    await user.click(within(screen.getAllByRole('listitem')[1]!).getByRole('button', { name: /delete/i }));
    expect(await screen.findByRole('alertdialog', { name: 'Delete status entry' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect((await client.get(app.id)).statusHistory).toHaveLength(2);
  });

  it('does not let the first entry change status when editing, but date and note stay editable', async () => {
    const user = userEvent.setup();
    setup();
    const first = (await screen.findAllByRole('listitem'))[0]!;
    await user.click(within(first).getByRole('button', { name: /edit/i }));
    expect(within(first).getByLabelText('Status')).toBeDisabled();
    expect(within(first).getByLabelText('Date')).toBeEnabled();
    expect(within(first).getByLabelText('Note')).toBeEnabled();
  });
});

const waitForItems = (n: number) => waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(n));
const waitForBadge = (text: string) => waitFor(() => expect(screen.getByTestId('badge')).toHaveTextContent(text));
