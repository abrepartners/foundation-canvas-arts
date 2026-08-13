import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";

export const APP_PASSCODE = "0801";
const AUTH_KEY = "botanical:passcode_auth";

interface AuthState {
  authenticated: boolean;
  loading: boolean;
  signInWithPasscode: (pin: string) => boolean;
  signOut: () => void;
}

const AuthContext = createContext<AuthState>({
  authenticated: false,
  loading: true,
  signInWithPasscode: () => false,
  signOut: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = sessionStorage.getItem(AUTH_KEY);
    setAuthenticated(stored === "1");
    setLoading(false);
  }, []);

  const value = useMemo(
    () => ({
      authenticated,
      loading,
      signInWithPasscode: (pin: string) => {
        if (pin.trim() !== APP_PASSCODE) return false;
        sessionStorage.setItem(AUTH_KEY, "1");
        setAuthenticated(true);
        return true;
      },
      signOut: () => {
        sessionStorage.removeItem(AUTH_KEY);
        setAuthenticated(false);
      },
    }),
    [authenticated, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { authenticated, loading } = useAuth();
  if (loading) {
    return <main className="min-h-screen grid place-items-center text-sm text-muted-foreground">Checking session…</main>;
  }
  if (!authenticated) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  return <>{children}</>;
}
