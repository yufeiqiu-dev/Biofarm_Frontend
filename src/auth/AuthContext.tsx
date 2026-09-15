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
import { syncCart } from "../api/cart";
import { clearLocalCart, loadLocalCart, toSyncPayload } from "../context/localCart";
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
    /*
     * The basket is flushed and cleared here, not reactively from a change in
     * `user` - this call is the last moment the access token is still valid.
     * `amplifySignOut()` below redirects through Cognito's hosted logout page,
     * which is a full-page navigation: by the time any component next reads
     * `user`, this whole provider (and CartSideBarProvider with it) has been
     * torn down and rebuilt from nothing, with no token left to flush against.
     *
     * Read from localStorage directly rather than through CartSideBarContext,
     * so this does not depend on that provider being mounted, or its debounce
     * having already caught up with the last edit - every mutation there
     * writes to storage synchronously, so this always sees the true basket.
     * The provider's flush gates on its own in-memory "dirty since last push"
     * flag; this has no such history to consult, so it gates on "is there
     * anything at all to send" instead. The two answers necessarily differ.
     */
    if (user) {
      try {
        const lines = loadLocalCart(user.user_id);
        if (lines.length > 0) await syncCart(toSyncPayload(lines));
      } catch {
        // Best effort - a basket that fails to flush here is not lost, only
        // stuck on this device until it next signs in somewhere and pulls.
      }
      // "If user signed in already then sign out the local storage should
      // clear" - this device's copy of that account's basket goes with the
      // session, whether or not the flush above succeeded.
      clearLocalCart(user.user_id);
    }

    // Cleared, not stored. "Put me back where I was" is sign-in's idea and it
    // does not survive the trip here: the page you are on when you sign out is
    // frequently the one you can no longer see. An admin signing out of
    // /admin/orders was sent straight back to it, where AdminRoute correctly
    // refused them - so signing out ended by accusing you of an authorisation
    // failure for doing exactly what you meant to.
    sessionStorage.removeItem(REDIRECT_PATH_KEY);
    await amplifySignOut();
  }, [user]);

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