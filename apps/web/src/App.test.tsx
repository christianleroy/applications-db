import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { App } from './App';

describe('App quick-add', () => {
  it.each(['/', '/statistics', '/reports', '/applications'])('opens the quick-add dialog from %s', async (path) => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.queryByRole('dialog')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Add application' }));
    expect(screen.getByRole('dialog', { name: 'Add application' })).toBeInTheDocument();
  });
});
