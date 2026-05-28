import { describe, it, expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import { AdminRoute } from './AdminRoute';
import { renderWithProviders } from '../../test/renderWithProviders';
import { createMockUser, createMockAdminUser } from '../../test/mocks/mockUser';

describe('AdminRoute', () => {
  it('renders children for a user with the Admin role', async () => {
    renderWithProviders(
      <AdminRoute><div>Admin content</div></AdminRoute>,
      { user: createMockAdminUser() }
    );

    await waitFor(() => {
      expect(screen.getByText('Admin content')).toBeInTheDocument();
    });
  });

  it('redirects to / for a user without the Admin role', async () => {
    renderWithProviders(
      <Routes>
        <Route path="/" element={<div>Home page</div>} />
        <Route
          path="/admin"
          element={<AdminRoute><div>Admin content</div></AdminRoute>}
        />
      </Routes>,
      { user: createMockUser({ roles: [] }), initialEntries: ['/admin'] }
    );

    await waitFor(() => {
      expect(screen.getByText('Home page')).toBeInTheDocument();
    });
    expect(screen.queryByText('Admin content')).not.toBeInTheDocument();
  });

  it('redirects to / when user is null (unauthenticated)', async () => {
    renderWithProviders(
      <Routes>
        <Route path="/" element={<div>Home page</div>} />
        <Route
          path="/admin"
          element={<AdminRoute><div>Admin content</div></AdminRoute>}
        />
      </Routes>,
      { user: null, initialEntries: ['/admin'] }
    );

    await waitFor(() => {
      expect(screen.getByText('Home page')).toBeInTheDocument();
    });
    expect(screen.queryByText('Admin content')).not.toBeInTheDocument();
  });
});
