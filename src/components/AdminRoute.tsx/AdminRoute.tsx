import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../auth/useAuth";
import { PageLoading, useLoadingState } from "../LoadingSpinner";
import { useEffect, useState } from "react";
import { useReminder } from "../../context/useReminder";

export function AdminRoute({ children }: { children: React.ReactNode }) {
  const { loading, isAuthenticated, user, refreshUser } = useAuth();
  const location = useLocation();
  const [checkingAccess, setCheckingAccess] = useState(true);
  const { showReminder } = useReminder();
  const load = useLoadingState(loading || checkingAccess);

  useEffect(() => {
    const runCheck = async () => {
      try {
        await refreshUser();
      } finally {
        setCheckingAccess(false);
      }
    };

    void runCheck();
  }, [refreshUser]);

  if (load.pending) {
    return <PageLoading label="Checking access..." visible={load.visible} />;
  }

  const isAdmin = user?.roles?.includes("Admin") ?? false;

  if (!isAuthenticated || !isAdmin) {
    showReminder({
        message: "Unauthorized. Admin user required.",
      });
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}