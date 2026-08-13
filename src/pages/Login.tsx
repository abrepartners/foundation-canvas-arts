import { useState, type FormEvent } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";

export default function Login() {
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const location = useLocation();
  const { authenticated, signInWithPasscode } = useAuth();
  const from = (location.state as { from?: string } | null)?.from ?? "/";

  if (authenticated) return <Navigate to={from} replace />;

  const handle = (event: FormEvent) => {
    event.preventDefault();
    setError(false);
    setBusy(true);
    const ok = signInWithPasscode(passcode);
    setBusy(false);
    if (!ok) {
      setError(true);
      setPasscode("");
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-6">
      <form onSubmit={handle} className="w-full max-w-sm space-y-5 border border-border rounded-lg p-8 bg-card">
        <div className="space-y-1">
          <h1 className="text-2xl font-serif">Botanical Studio</h1>
          <p className="text-sm text-muted-foreground">Enter the owner passcode to continue.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="passcode">Passcode</Label>
          <Input
            id="passcode"
            type="password"
            inputMode="numeric"
            maxLength={4}
            autoComplete="one-time-code"
            required
            value={passcode}
            onChange={(e) => setPasscode(e.target.value.replace(/\D/g, ""))}
            autoFocus
            placeholder="••••"
          />
          {error && <p className="text-sm text-destructive">Incorrect passcode.</p>}
        </div>
        <Button type="submit" className="w-full" disabled={busy || passcode.length !== 4}>
          {busy ? "Checking…" : "Enter"}
        </Button>
      </form>
    </main>
  );
}
