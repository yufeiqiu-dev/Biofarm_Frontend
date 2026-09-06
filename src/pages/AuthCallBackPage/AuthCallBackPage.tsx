import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { PageLoading } from "../../components/LoadingSpinner";
import { useAuth } from "../../auth/useAuth";

/**
 * Where sign-in is allowed to send someone afterwards.
 *
 * The stored value comes from `window.location` at the moment signIn() was
 * called, so anyone who can get a customer to begin sign-in from a URL of their
 * choosing controls it.
 *
 * `startsWith("/")` was the whole check, and it is the classic insufficient
 * one: `//evil.com` is a protocol-relative URL that passes it and resolves
 * off-site, as does `/\evil.com`, since browsers treat a backslash in the
 * authority position as a slash. Whether the router happens to honour those is
 * not something to rely on - the check should be right regardless.
 *
 * Worth more care than an ordinary open redirect, because this lands the
 * moment authentication completes: the destination is exactly where someone
 * expects to arrive signed in, which is what would make a credential-phishing
 * page there convincing.
 */
export function safeRedirect(stored: string | null): string {
  if (!stored) return "/";

  // Browsers strip tab, newline and carriage return before parsing a URL, so
  // "/<tab>/evil.com" becomes "//evil.com" after they are gone. Strip them
  // first, and judge what the browser would actually see.
  const target = stored.replace(/[\t\n\r]/g, "");

  if (!target.startsWith("/")) return "/";
  if (target.startsWith("//") || target.startsWith("/\\")) return "/";

  return target;
}

export function AuthCallBackPage() {
  const navigate = useNavigate();
  const { loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    navigate(safeRedirect(sessionStorage.getItem("RedirectPath")), { replace: true });
  }, [loading, navigate]);

  return <PageLoading label="Signing you in..." />;
}
