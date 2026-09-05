import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../auth/useAuth";
import { LoadingOverlay } from "../LoadingSpinner";
import { useEffect, useState } from "react";
import { useReminder } from "../../context/useReminder";

export function AdminRoute({ children }: { children: React.ReactNode }) {
  const { loading, isAuthenticated, user, refreshUser } = useAuth();
  const location = useLocation();
  const [checkingAccess, setCheckingAccess] = useState(true);
  const { showReminder } = useReminder();

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

  if (loading || checkingAccess) {
    return <LoadingOverlay visible={true} />;
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