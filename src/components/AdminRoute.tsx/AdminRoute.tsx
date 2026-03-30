import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { LoadingOverlay } from "../LoadingSpinner";
import { useEffect, useState } from "react";

export function AdminRoute({ children }: { children: React.ReactNode }) {
  const { loading, isAuthenticated, user, refreshUser } = useAuth();
  const location = useLocation();
  const [checkingAccess, setCheckingAccess] = useState(true);

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
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}