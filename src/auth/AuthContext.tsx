import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { User } from "../types/user_type";
import {
  fetchAuthSession,
  getCurrentUser,
  signInWithRedirect,
  signOut as amplifySignOut,
} from "aws-amplify/auth";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
  getAccessToken: () => Promise<string | null>;
  getUserGroups: () => Promise<string[]>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const REDIRECT_PATH_KEY = "RedirectPath";

function mapCognitoToUser(params: {
  userId: string;
  username: string;
  email?: string;
}): User {
  return {
    user_id: params.userId,
    name: params.email ?? params.username,
  };
}

function getCurrentPath() {
  return (
    window.location.pathname +
    window.location.search +
    window.location.hash
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    try {
      const currentUser = await getCurrentUser();
      const session = await fetchAuthSession();
      const email = session.tokens?.idToken?.payload?.email?.toString();

      setUser(
        mapCognitoToUser({
          userId: currentUser.userId,
          username: currentUser.username,
          email,
        })
      );
    } catch {
      setUser(null);
    }
  };

  useEffect(() => {
    const bootstrap = async () => {
      setLoading(true);
      try {
        await refreshUser();
      } finally {
        setLoading(false);
      }
    };

    void bootstrap();
  }, []);

  const signIn = async () => {
    sessionStorage.setItem(REDIRECT_PATH_KEY, getCurrentPath());
    await signInWithRedirect();
  };

  const signOut = async () => {
    sessionStorage.setItem(REDIRECT_PATH_KEY, getCurrentPath());
    await amplifySignOut();
  };

  const getAccessToken = async () => {
    try {
      const session = await fetchAuthSession();
      return session.tokens?.accessToken?.toString() ?? null;
    } catch {
      return null;
    }
  };

  const getUserGroups = async () => {
    try {
      const session = await fetchAuthSession();

      const groups =
        session.tokens?.accessToken?.payload["cognito:groups"] ??
        session.tokens?.idToken?.payload["cognito:groups"] ??
        [];

      return Array.isArray(groups) ? groups.map(String) : [];
    } catch {
      return [];
    }
  };

  const value = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated: !!user,
      signIn,
      signOut,
      refreshUser,
      getAccessToken,
      getUserGroups,
    }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}