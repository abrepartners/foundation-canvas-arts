import { useState, type FormEvent } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";

export default function Login() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const { toast } = useToast();
  const location = useLocation();
  const { session, loading } = useAuth();
  const from = (location.state as { from?: string } | null)?.from ?? "/";

  if (!loading && session) return <Navigate to={from} replace />;

  const handle = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    const redirectTo = `${window.location.origin}${from}`;
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: redirectTo, shouldCreateUser: false },
    });
    setBusy(false);
    if (error) {
      toast({ title: "Sign-in link could not be sent", description: error.message, variant: "destructive" });
      return;
    }
    setSent(true);
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-6">
      <form onSubmit={handle} className="w-full max-w-sm space-y-5 border border-border rounded-lg p-8 bg-card">
        <div className="space-y-1">
          <h1 className="text-2xl font-serif">Botanical Studio</h1>
          <p className="text-sm text-muted-foreground">
            {sent ? "Check your email for the secure sign-in link." : "Sign in with the approved owner email."}
          </p>
        </div>
        {!sent && (
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
          </div>
        )}
        <Button type="submit" className="w-full" disabled={busy || sent || !email.trim()}>
          {busy ? "Sending…" : sent ? "Link sent" : "Email me a sign-in link"}
        </Button>
        {sent && <Button type="button" variant="ghost" className="w-full" onClick={() => setSent(false)}>Use a different email</Button>}
      </form>
    </main>
  );
}
