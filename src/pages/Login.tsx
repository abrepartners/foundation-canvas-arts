import { useState, type FormEvent } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

export default function Login() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
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
    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${window.location.origin}/`,
      },
    });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    setSent(true);
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
            Sign in with the approved owner email.
          </p>
        </div>
        {sent ? (
          <p className="text-sm text-muted-foreground">
            Check your inbox for the sign-in link. You can close this tab once it opens.
          </p>
        ) : (
          <>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
                placeholder="you@example.com"
              />
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
            <Button type="submit" className="w-full" disabled={busy || !email.trim()}>
              {busy ? "Sending…" : "Send sign-in link"}
            </Button>
          </>
        )}
      </form>
    </main>
  );
}
