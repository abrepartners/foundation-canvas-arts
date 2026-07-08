import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";

const UNLOCK_KEY = "app_unlocked";
const PASSCODE_KEY = "app_passcode";

export function isUnlocked(): boolean {
  try {
    return sessionStorage.getItem(UNLOCK_KEY) === "1";
  } catch {
    return false;
  }
}

export function getPasscode(): string {
  try {
    return sessionStorage.getItem(PASSCODE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function unlock(passcode: string) {
  try {
    sessionStorage.setItem(UNLOCK_KEY, "1");
    sessionStorage.setItem(PASSCODE_KEY, passcode);
  } catch {
    /* ignore */
  }
}

export function lock() {
  try {
    sessionStorage.removeItem(UNLOCK_KEY);
    sessionStorage.removeItem(PASSCODE_KEY);
  } catch {
    /* ignore */
  }
}

export function useUnlocked(): boolean {
  const [ok, setOk] = useState(isUnlocked());
  useEffect(() => {
    const check = () => setOk(isUnlocked());
    window.addEventListener("storage", check);
    return () => window.removeEventListener("storage", check);
  }, []);
  return ok;
}

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  if (!isUnlocked()) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  return <>{children}</>;
}
