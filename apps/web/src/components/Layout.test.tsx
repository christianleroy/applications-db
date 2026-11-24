import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { Layout } from './Layout';

describe('Layout', () => {
  it('renders nav links and the memory footer', () => {
    render(
      <MemoryRouter>
        <Layout />
      </MemoryRouter>,
    );
    const hrefs = ['Dashboard', 'Applications', 'Statistics', 'Reports'].map((n) =>
      screen.getByRole('link', { name: n }).getAttribute('href'),
    );
    expect(hrefs).toEqual(['/', '/applications', '/statistics', '/reports']);
    expect(screen.getByText('Data source: In-memory (sample data, resets on reload)')).toBeInTheDocument();
  });

  it('marks header and footer to be hidden when printing', () => {
    render(
      <MemoryRouter>
        <Layout />
      </MemoryRouter>,
    );
    expect(screen.getByRole('banner')).toHaveAttribute('data-print-hide');
    expect(screen.getByRole('contentinfo')).toHaveAttribute('data-print-hide');
  });
});
