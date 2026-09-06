import { apiRequest } from "./client";

/** A Cognito account, as much of it as the admin console shows. */
export interface AdminAccount {
  sub: string;
  username: string;
  email: string;
  name: string;
  status: string;
  enabled: boolean;
  created_at: string | null;
  /** The identity AUTH_BYPASS invents locally, rather than a real account. */
  synthetic: boolean;
}

/**
 * Resolves an order's `user_id` to the account that placed it.
 *
 * Worth having because `customer_email` is now where the customer asked order
 * mail to go, which need not be their own address - so it no longer identifies
 * the account. Rejects on 404 when the account has been deleted, which is a
 * normal thing for an order to outlive, and on 502 when Cognito could not be
 * reached; the caller must not present the second as the first.
 */
export function getAdminAccount(sub: string): Promise<AdminAccount> {
  return apiRequest(`/admin/users/${encodeURIComponent(sub)}`, { auth: true });
}
