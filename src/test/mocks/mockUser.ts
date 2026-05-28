import type { User } from '../../types/user_type';

export function createMockUser(overrides: Partial<User> = {}): User {
  return {
    user_id: 'user-1',
    name: 'test@example.com',
    roles: [],
    ...overrides,
  };
}

export function createMockAdminUser(overrides: Partial<User> = {}): User {
  return createMockUser({ roles: ['Admin'], ...overrides });
}
