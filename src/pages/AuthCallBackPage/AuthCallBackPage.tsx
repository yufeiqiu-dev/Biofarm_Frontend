import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { PageLoading } from "../../components/LoadingSpinner";
import { useAuth } from "../../auth/useAuth";
import { safeRedirect } from "./safeRedirect";

export function AuthCallBackPage() {
  const navigate = useNavigate();
  const { loading } = useAuth();

  useEffect(() => {
    if (loading) return;

    // Read once and removed. It is a one-shot value, and leaving it behind
    // meant the next person to sign in on this tab inherited the last one's
    // destination - including an admin page they have no access to.
    const stored = sessionStorage.getItem("RedirectPath");
    sessionStorage.removeItem("RedirectPath");

    navigate(safeRedirect(stored), { replace: true });
  }, [loading, navigate]);

  return <PageLoading label="Signing you in..." />;
}
