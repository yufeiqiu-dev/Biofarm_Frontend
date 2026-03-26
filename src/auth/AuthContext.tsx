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
  getIdToken: () => Promise<string | null>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    try {
      const currentUser = await getCurrentUser();
      const session = await fetchAuthSession();

      const email = session.tokens?.idToken?.payload?.email?.toString();
      const name = session.tokens?.idToken?.payload?.name?.toString();
      
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
    finally{
      console.log(user)
    } 
  };

  useEffect(() => {
    const bootstrapAuth = async () => {
      setLoading(true);
      try {
        await refreshUser();
      } finally {
        setLoading(false);
      }
    };

    void bootstrapAuth();
  }, []);

  useEffect(() => {
    console.log("react user state:", user);
  }, [user]);

  const signIn = async () => {
    await signInWithRedirect();
  };

  const signOut = async () => {
    await amplifySignOut();
    setUser(null);
  };

  const getAccessToken = async () => {
    const session = await fetchAuthSession();
    return session.tokens?.accessToken?.toString() ?? null;
  };

  const getIdToken = async () => {
    const session = await fetchAuthSession();
    return session.tokens?.idToken?.toString() ?? null;
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      isAuthenticated: !!user,
      signIn,
      signOut,
      refreshUser,
      getAccessToken,
      getIdToken,
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