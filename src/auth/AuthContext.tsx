import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";
import type { User } from "../types/user_type";

type AuthContextValue = {
  user: User | null;
  signIn: () => void;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  const signIn = () => {
    // TODO: replace with real Cognito sign-in flow
    setUser({ user_id: "abc", name: "Demo User" });
  };

  const signOut = () => {
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}

