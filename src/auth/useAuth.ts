import { createContext, useContext } from "react";
import type { User } from "../types/user_type";

export type AuthContextValue = {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
  getAccessToken: () => Promise<string | null>;
  getUserGroups: () => Promise<string[]>;
};

// The context and its hook live apart from AuthProvider so that file exports
// only components. Mixing the two breaks React Fast Refresh: a file exporting
// both cannot be hot-swapped, so editing the provider forces a full reload and
// drops the state you were trying to look at.
export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
