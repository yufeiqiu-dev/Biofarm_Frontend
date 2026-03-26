import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { LoadingOverlay} from "../../components/LoadingSpinner";
import { useAuth } from "../../auth/AuthContext";

export function AuthCallBackPage() {
  const navigate = useNavigate();
  const { loading } = useAuth();
  useEffect(() => {
    if (loading) return;
    const target = sessionStorage.getItem("RedirectPath") || "/";
    const safeTarget = target.startsWith("/") ? target : "/";
    navigate(safeTarget, { replace: true });
  }, [loading, navigate]);

  return <>
    <LoadingOverlay visible={true}/>
  </>;
}