import { useEffect, useState } from "react";
import { useNavigate, useLocation, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";

const ALLOWED_EMAIL = "info@nuelementsmedia.com";

export function useAuthorizedSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => {
      setSession(s);
      setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const email = session?.user?.email?.toLowerCase() ?? null;
  const authorized = !!session && email === ALLOWED_EMAIL;
  return { session, ready, authorized, email };
}

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { ready, authorized, session } = useAuthorizedSession();
  const location = useLocation();
  const navigate = useNavigate();

  // Sign out unauthorized (wrong-email) sessions so they can't linger.
  useEffect(() => {
    if (ready && session && !authorized) {
      supabase.auth.signOut().finally(() => navigate("/login", { replace: true }));
    }
  }, [ready, session, authorized, navigate]);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground text-sm">
        Loading…
      </div>
    );
  }
  if (!authorized) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  return <>{children}</>;
}

export { ALLOWED_EMAIL };
