import {
  useEffect,
  useMemo,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type { User } from "../types/user_type";
import {
  fetchAuthSession,
  getCurrentUser,
  signInWithRedirect,
  signOut as amplifySignOut,
} from "aws-amplify/auth";
import { setSessionGetter } from "../api/client";
import { AuthContext } from "./useAuth";

const REDIRECT_PATH_KEY = "RedirectPath";

function mapCognitoToUser(params: {
  userId: string;
  username: string;
  email?: string;
  roles?: string[];
}): User {
  return {
    user_id: params.userId,
    name: params.email ?? params.username,
    email: params.email,
    roles: params.roles ?? [],
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

  const refreshUser = useCallback(async () => {
    try {
      const currentUser = await getCurrentUser();
      const session = await fetchAuthSession();
      const email = session.tokens?.idToken?.payload?.email?.toString();
      const groups =
        session.tokens?.accessToken?.payload["cognito:groups"] ??
        session.tokens?.idToken?.payload["cognito:groups"] ??
        [];

      const roles = Array.isArray(groups) ? groups.map(String) : [];

      setUser(
        mapCognitoToUser({
          userId: currentUser.userId,
          username: currentUser.username,
          email,
          roles,
        })
      );
    } catch {
      setUser(null);
    }
  }, []);

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
  }, [refreshUser]);

  const signIn = useCallback(async () => {
    sessionStorage.setItem(REDIRECT_PATH_KEY, getCurrentPath());
    await signInWithRedirect();
  }, []);

  const signOut = useCallback(async () => {
    sessionStorage.setItem(REDIRECT_PATH_KEY, getCurrentPath());
    await amplifySignOut();
  }, []);

  const getSessionTokens = useCallback(async () => {
    try {
      const session = await fetchAuthSession();
      const accessToken = session.tokens?.accessToken?.toString();
      if (!accessToken) return null;
      return {
        accessToken,
        idToken: session.tokens?.idToken?.toString() ?? undefined,
      };
    } catch {
      return null;
    }
  }, []);

  const getAccessToken = useCallback(async () => {
    const session = await getSessionTokens();
    return session?.accessToken ?? null;
  }, [getSessionTokens]);

  const getUserGroups = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    setSessionGetter(getSessionTokens);
    return () => setSessionGetter(null);
  }, [getSessionTokens]);

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
    [user, loading, signIn, signOut, refreshUser, getAccessToken, getUserGroups]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}