import { useState, type FormEvent } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { invokeFn, readFnError } from "@/lib/invokeFn";

interface PinLoginResponse {
  success?: boolean;
  session?: {
    access_token?: string;
    refresh_token?: string;
  };
  error?: string;
}

export default function Login() {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const location = useLocation();
  const { authenticated } = useAuth();
  const from = (location.state as { from?: string } | null)?.from ?? "/";

  if (authenticated) return <Navigate to={from} replace />;

  const handle = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const { data, error: fnError } = await invokeFn<PinLoginResponse>("pin-login", {
        body: { pin },
      });
      if (fnError) {
        const detail = await readFnError(fnError);
        if (detail.status === 429) {
          throw new Error("Too many attempts. Wait 15 minutes and try again.");
        }
        throw new Error("That PIN is incorrect.");
      }
      const accessToken = data?.session?.access_token;
      const refreshToken = data?.session?.refresh_token;
      if (!data?.success || !accessToken || !refreshToken) {
        throw new Error(data?.error || "Unable to start a secure session.");
      }
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (sessionError) throw sessionError;
    } catch (err) {
      setPin("");
      setError(err instanceof Error ? err.message : "Unable to sign in.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-6">
      <form
        onSubmit={handle}
        className="w-full max-w-sm space-y-5 border border-border rounded-lg p-8 bg-card"
      >
        <div className="space-y-1">
          <h1 className="text-2xl font-serif">Botanical Studio</h1>
          <p className="text-sm text-muted-foreground">
            Enter your six-digit access PIN.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="pin">PIN code</Label>
          <Input
            id="pin"
            type="password"
            inputMode="numeric"
            autoComplete="current-password"
            pattern="[0-9]{6}"
            minLength={6}
            maxLength={6}
            required
            value={pin}
            onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))}
            autoFocus
            aria-describedby={error ? "pin-error" : undefined}
          />
          {error && <p id="pin-error" className="text-sm text-destructive">{error}</p>}
        </div>
        <Button type="submit" className="w-full" disabled={busy || pin.length !== 6}>
          {busy ? "Unlocking…" : "Unlock studio"}
        </Button>
      </form>
    </main>
  );
}
