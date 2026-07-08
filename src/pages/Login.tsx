import { useState, type FormEvent } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ALLOWED_EMAIL, useAuthorizedSession } from "@/lib/auth";
import { Navigate } from "react-router-dom";

type Mode = "signin" | "signup";

export default function Login() {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const { authorized, ready } = useAuthorizedSession();

  const from = (location.state as { from?: string } | null)?.from ?? "/";

  if (ready && authorized) {
    return <Navigate to={from} replace />;
  }

  const handle = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (email.trim().toLowerCase() !== ALLOWED_EMAIL) {
        toast({
          title: "Access denied",
          description: "This app is restricted to a single authorized account.",
          variant: "destructive",
        });
        return;
      }
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
      }
      navigate(from, { replace: true });
    } catch (err) {
      toast({
        title: mode === "signup" ? "Sign up failed" : "Sign in failed",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
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
            Private tool. Authorized access only.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
        </Button>
        <button
          type="button"
          className="text-xs text-muted-foreground underline w-full text-center"
          onClick={() => setMode((m) => (m === "signin" ? "signup" : "signin"))}
        >
          {mode === "signin"
            ? "First time? Create your account"
            : "Already have an account? Sign in"}
        </button>
      </form>
    </main>
  );
}
