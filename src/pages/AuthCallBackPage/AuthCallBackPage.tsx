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
    navigate(safeRedirect(sessionStorage.getItem("RedirectPath")), { replace: true });
  }, [loading, navigate]);

  return <PageLoading label="Signing you in..." />;
}
