import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { UpdateApplicationInput } from '@applications-db/shared';
import { describe, expect, it, vi } from 'vitest';
import { ClientProvider } from '../data/ClientProvider';
import { MemoryClient } from '../data/memoryClient';
import { ApplicationForm } from './ApplicationForm';

async function setup(stored: UpdateApplicationInput = {}) {
  const client = new MemoryClient([]);
  const created = await client.create({
    company: 'Acme',
    role: 'Engineer',
    source: 'linkedin',
    dateApplied: '2026-11-01',
    contacts: [],
  });
  const initial = await client.update(created.id, stored);
  const updateSpy = vi.spyOn(client, 'update');
  const onSaved = vi.fn();
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <ClientProvider client={client}>
        <MemoryRouter>
          <ApplicationForm initial={initial} onSaved={onSaved} />
        </MemoryRouter>
      </ClientProvider>
    </QueryClientProvider>,
  );
  return { client, id: created.id, updateSpy, onSaved };
}

describe('ApplicationForm', () => {
  it('shows the salary range error and does not call update', async () => {
    const user = userEvent.setup();
    const { updateSpy } = await setup();
    await user.type(screen.getByLabelText('Salary min'), '100');
    await user.type(screen.getByLabelText('Salary max'), '50');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Max must be at least min')).toBeInTheDocument();
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('shows an error on the posting URL field for an invalid URL', async () => {
    const user = userEvent.setup();
    const { updateSpy } = await setup();
    await user.type(screen.getByLabelText('Posting URL'), 'not a url');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    const field = screen.getByLabelText('Posting URL');
    await waitFor(() => expect(field).toHaveAccessibleDescription(/.+/));
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('shows a required error when company is cleared', async () => {
    const user = userEvent.setup();
    const { updateSpy } = await setup();
    await user.clear(screen.getByLabelText('Company'));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Company is required')).toBeInTheDocument();
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('adds a contact and persists it on save', async () => {
    const user = userEvent.setup();
    const { client, id, onSaved } = await setup();
    await user.click(screen.getByRole('button', { name: 'Add contact' }));
    await user.type(screen.getByLabelText('Contact 1 name'), 'Pat Recruiter');
    await user.type(screen.getByLabelText('Contact 1 email'), 'pat@example.com');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect((await client.get(id)).contacts).toEqual([{ name: 'Pat Recruiter', email: 'pat@example.com' }]);
  });

  it('removes a contact row', async () => {
    const user = userEvent.setup();
    const { client, id, onSaved } = await setup({ contacts: [{ name: 'Pat' }] });
    expect((await client.get(id)).contacts).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Remove contact 1' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect((await client.get(id)).contacts).toEqual([]);
  });

  it('clears notes when they are emptied and saved', async () => {
    const user = userEvent.setup();
    const { client, id, onSaved } = await setup({ notes: 'remember this' });
    expect(screen.getByLabelText('Notes')).toHaveValue('remember this');
    await user.clear(screen.getByLabelText('Notes'));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect('notes' in (await client.get(id))).toBe(false);
  });

  it('does not send whitespace-only optional values', async () => {
    const user = userEvent.setup();
    const { client, id, onSaved } = await setup();
    await user.type(screen.getByLabelText('Location'), '   ');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect('location' in (await client.get(id))).toBe(false);
  });

  it('saves a salary range', async () => {
    const user = userEvent.setup();
    const { client, id, onSaved } = await setup();
    await user.type(screen.getByLabelText('Salary min'), '50');
    await user.type(screen.getByLabelText('Salary max'), '100');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect((await client.get(id)).salary).toEqual({ min: 50, max: 100, currency: 'USD', period: 'year' });
  });

  it('shows server errors at the top', async () => {
    const user = userEvent.setup();
    const { updateSpy } = await setup();
    const { ClientError } = await import('../data/client');
    updateSpy.mockRejectedValueOnce(new ClientError(409, 'CONFLICT', 'Entry conflicts with history'));
    await user.type(screen.getByLabelText('Location'), 'Paris');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Entry conflicts with history');
  });

  it('shows a contact error on the row it belongs to when blank rows precede it', async () => {
    const user = userEvent.setup();
    const { updateSpy } = await setup();
    await user.click(screen.getByRole('button', { name: 'Add contact' }));
    await user.click(screen.getByRole('button', { name: 'Add contact' }));
    await user.type(screen.getByLabelText('Contact 2 email'), 'pat@example.com');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.getByLabelText('Contact 2 name')).toHaveAccessibleDescription(/.+/));
    expect(screen.getByLabelText('Contact 1 name')).not.toHaveAccessibleDescription();
    expect(updateSpy).not.toHaveBeenCalled();
  });
});
