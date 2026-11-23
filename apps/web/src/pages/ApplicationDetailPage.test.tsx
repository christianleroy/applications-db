import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
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
    expect(screen.getByRole('dialog', { name: 'Delete application' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(await screen.findByText('list page')).toBeInTheDocument();
    await expect(client.get(app.id)).rejects.toMatchObject({ status: 404 });
  });

  it('keeps the application when the delete is cancelled', async () => {
    const user = userEvent.setup();
    const app = make();
    const client = setup(app);
    await user.click(await screen.findByRole('button', { name: 'Delete application' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    await expect(client.get(app.id)).resolves.toMatchObject({ id: app.id });
  });
});
