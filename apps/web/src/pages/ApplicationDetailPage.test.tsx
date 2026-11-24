import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import { createApplication, type Application } from '@applications-db/shared';
import { describe, expect, it } from 'vitest';
import { ClientProvider } from '../data/ClientProvider';
import { MemoryClient } from '../data/memoryClient';
import { ApplicationDetailPage } from './ApplicationDetailPage';

const newId = () => crypto.randomUUID();

function make(postingUrl?: string): Application {
  const app = createApplication(
    { company: 'Acme', role: 'Engineer', source: 'linkedin', dateApplied: '2026-10-10', contacts: [] },
    newId,
    '2026-10-10T00:00:00.000Z',
  );
  return postingUrl ? { ...app, postingUrl } : app;
}

function setup(app: Application | null, id = app?.id ?? 'missing') {
  const client = new MemoryClient(app ? [app] : []);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <ClientProvider client={client}>
        <MemoryRouter initialEntries={[`/applications/${id}`]}>
          <Routes>
            <Route path="/applications" element={<div>list page</div>} />
            <Route path="/applications/:id" element={<ApplicationDetailPage />} />
          </Routes>
        </MemoryRouter>
      </ClientProvider>
    </QueryClientProvider>,
  );
  return client;
}

describe('ApplicationDetailPage', () => {
  it('shows the header with company, role and status', async () => {
    setup(make());
    expect(await screen.findByRole('heading', { name: /Acme/ })).toHaveTextContent('Engineer');
    expect(screen.getByLabelText('Company')).toHaveValue('Acme');
  });

  it('shows application not found with a link back for an unknown id', async () => {
    setup(null);
    expect(await screen.findByText('Application not found')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /back to applications/i })).toHaveAttribute('href', '/applications');
  });

  it('renders an https posting URL as a safe external link', async () => {
    setup(make('https://example.com/job'));
    const link = await screen.findByRole('link', { name: 'https://example.com/job' });
    expect(link).toHaveAttribute('href', 'https://example.com/job');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('does not render a javascript: posting URL as a link', async () => {
    setup(make('javascript:alert(1)'));
    const text = await screen.findByText('javascript:alert(1)');
    expect(text.closest('a')).toBeNull();
    expect(screen.queryByRole('link', { name: 'javascript:alert(1)' })).toBeNull();
  });

  it('deletes after confirming and returns to the list', async () => {
    const user = userEvent.setup();
    const app = make();
    const client = setup(app);
    await user.click(await screen.findByRole('button', { name: 'Delete application' }));
    expect(await screen.findByRole('alertdialog', { name: 'Delete application' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(await screen.findByText('list page')).toBeInTheDocument();
    await expect(client.get(app.id)).rejects.toMatchObject({ status: 404 });
  });

  it('keeps the application when the delete is cancelled', async () => {
    const user = userEvent.setup();
    const app = make();
    const client = setup(app);
    await user.click(await screen.findByRole('button', { name: 'Delete application' }));
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    await expect(client.get(app.id)).resolves.toMatchObject({ id: app.id });
  });

  it('cancels the delete confirmation on Escape', async () => {
    const user = userEvent.setup();
    const app = make();
    const client = setup(app);
    await user.click(await screen.findByRole('button', { name: 'Delete application' }));
    expect(await screen.findByRole('alertdialog', { name: 'Delete application' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(screen.getByRole('heading', { name: /Acme/ })).toBeInTheDocument();
    await expect(client.get(app.id)).resolves.toMatchObject({ id: app.id });
  });

  it('keeps unsaved form edits when the timeline changes', async () => {
    const user = userEvent.setup();
    setup(make());
    const notes = await screen.findByLabelText('Notes');
    await user.type(notes, 'draft notes');
    await user.click(screen.getByRole('button', { name: 'Add status' }));
    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(2));
    expect(screen.getByLabelText('Notes')).toHaveValue('draft notes');
  });

  it('resyncs an untouched date applied when the first entry date is edited', async () => {
    const user = userEvent.setup();
    setup(make());
    await screen.findByLabelText('Company');
    const first = screen.getAllByRole('listitem')[0]!;
    await user.click(within(first).getByRole('button', { name: /edit/i }));
    fireEvent.change(within(first).getByLabelText('Date'), { target: { value: '2026-10-12' } });
    await user.click(within(first).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.getByLabelText('Date applied')).toHaveValue('2026-10-12'));
  });

  it('clears the Saved banner on the next form edit and on a timeline change', async () => {
    const user = userEvent.setup();
    setup(make());
    await user.type(await screen.findByLabelText('Notes'), 'x');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Saved')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Notes'), 'y');
    expect(screen.queryByText('Saved')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Saved')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add status' }));
    await waitFor(() => expect(screen.queryByText('Saved')).toBeNull());
  });

  it('shows a readable message, not the error code, when the date applied moves past a later status', async () => {
    const user = userEvent.setup();
    setup(make());
    await user.click(await screen.findByRole('button', { name: 'Add status' }));
    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(2));
    fireEvent.change(screen.getByLabelText('Date applied'), { target: { value: '2027-12-31' } });
    await user.click(screen.getByRole('button', { name: 'Save' }));
    const alert = await screen.findByText("A status can't be dated before the application date.");
    expect(alert).toHaveAttribute('role', 'alert');
    expect(screen.queryByText('ENTRY_BEFORE_APPLIED')).toBeNull();
  });

  it('saves the timeline date when date applied was edited and reverted before the timeline changed', async () => {
    const user = userEvent.setup();
    const app = make();
    const client = setup(app);
    const dateApplied = await screen.findByLabelText('Date applied');
    fireEvent.change(dateApplied, { target: { value: '2026-10-11' } });
    fireEvent.change(dateApplied, { target: { value: '2026-10-10' } });
    const first = screen.getAllByRole('listitem')[0]!;
    await user.click(within(first).getByRole('button', { name: /edit/i }));
    fireEvent.change(within(first).getByLabelText('Date'), { target: { value: '2026-10-12' } });
    await user.click(within(first).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.getByLabelText('Date applied')).toHaveValue('2026-10-12'));
    await user.type(screen.getByLabelText('Notes'), 'x');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Saved')).toBeInTheDocument();
    await expect(client.get(app.id)).resolves.toMatchObject({ dateApplied: '2026-10-12', notes: 'x' });
  });

  it('does not carry the Saved banner over to another application', async () => {
    const user = userEvent.setup();
    const a = make();
    const b = { ...make(), id: newId(), company: 'Globex' };
    const client = new MemoryClient([a, b]);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <ClientProvider client={client}>
          <MemoryRouter initialEntries={[`/applications/${a.id}`]}>
            <Link to={`/applications/${b.id}`}>go to b</Link>
            <Routes>
              <Route path="/applications/:id" element={<ApplicationDetailPage />} />
            </Routes>
          </MemoryRouter>
        </ClientProvider>
      </QueryClientProvider>,
    );
    await user.type(await screen.findByLabelText('Notes'), 'x');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Saved')).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'go to b' }));
    expect(await screen.findByRole('heading', { name: /Globex/ })).toBeInTheDocument();
    expect(screen.queryByText('Saved')).toBeNull();
  });
});
