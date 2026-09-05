import { render, type RenderOptions as RTLRenderOptions } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import type { ReactElement, ReactNode } from 'react';
import { AuthContext } from '../auth/useAuth';
import { ReminderContext } from '../context/useReminder';
import { CartSideBarProvider } from '../context/CartSideBarContext';
import type { User } from '../types/user_type';
import { createMockUser } from './mocks/mockUser';

type MockAuthValue = ReturnType<typeof createMockAuthValue>;
type MockReminderValue = ReturnType<typeof createMockReminderValue>;

interface RenderOptions extends Omit<RTLRenderOptions, 'wrapper'> {
  user?: User | null;
  initialEntries?: string[];
  /** Override parts of the auth context - a spy on signIn, say. Merged over
   *  the value `user` would otherwise produce. */
  authValue?: Partial<MockAuthValue>;
  /** Override parts of the reminder context, to assert on showReminder. */
  reminderValue?: Partial<MockReminderValue>;
}

export function createMockAuthValue(user: User | null) {
  return {
    user,
    loading: false,
    isAuthenticated: !!user,
    signIn: vi.fn().mockResolvedValue(undefined),
    signOut: vi.fn().mockResolvedValue(undefined),
    refreshUser: vi.fn().mockResolvedValue(undefined),
    getAccessToken: vi.fn().mockResolvedValue(null),
    getUserGroups: vi.fn().mockResolvedValue([]),
  };
}

export function createMockReminderValue() {
  return {
    message: null as string | null,
    visible: false,
    showReminder: vi.fn(),
    hideReminder: vi.fn(),
  };
}

export function createProviderWrapper(options: RenderOptions = {}) {
  const {
    user = createMockUser(),
    initialEntries = ['/'],
    authValue: authOverrides,
    reminderValue: reminderOverrides,
  } = options;
  const authValue = { ...createMockAuthValue(user), ...authOverrides };
  const reminderValue = { ...createMockReminderValue(), ...reminderOverrides };

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <MemoryRouter initialEntries={initialEntries}>
        <AuthContext.Provider value={authValue}>
          <ReminderContext.Provider value={reminderValue}>
            <CartSideBarProvider>
              {children}
            </CartSideBarProvider>
          </ReminderContext.Provider>
        </AuthContext.Provider>
      </MemoryRouter>
    );
  };
}

export function renderWithProviders(ui: ReactElement, options: RenderOptions = {}) {
  const { user, initialEntries, authValue, reminderValue, ...renderOptions } = options;
  return render(ui, {
    wrapper: createProviderWrapper({ user, initialEntries, authValue, reminderValue }),
    ...renderOptions,
  });
}
