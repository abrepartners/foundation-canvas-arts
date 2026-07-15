import { useState, type FormEvent } from "react";
import { useNavigate, useLocation, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { unlock, useUnlocked } from "@/lib/auth";

export default function Login() {
  const [passcode, setPasscode] = useState("");
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const unlocked = useUnlocked();

  const from = (location.state as { from?: string } | null)?.from ?? "/";
  if (unlocked) return <Navigate to={from} replace />;

  const handle = async (e: FormEvent) => {
    e.preventDefault();
    if (passcode.length !== 4) return;
    setBusy(true);
    try {
      // Verify server-side by pinging a guarded function.
      const { error } = await supabase.functions.invoke("score-content", {
        body: { __ping: true },
        headers: { "x-app-passcode": passcode },
      });
      const status = (error as { context?: { status?: number } } | null)?.context?.status;
      if (status === 401) {
        toast({ title: "Wrong passcode", variant: "destructive" });
        setPasscode("");
        return;
      }
      unlock(passcode);
      navigate(from, { replace: true });
    } catch (err) {
      toast({
        title: "Sign in failed",
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
            Enter the 4-digit passcode to continue.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="passcode">Passcode</Label>
          <Input
            id="passcode"
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="one-time-code"
            required
            maxLength={4}
            value={passcode}
            onChange={(e) => setPasscode(e.target.value.replace(/\D/g, "").slice(0, 4))}
            className="text-center tracking-[0.5em] text-lg"
            autoFocus
          />
        </div>
        <Button type="submit" className="w-full" disabled={busy || passcode.length !== 4}>
          {busy ? "Checking…" : "Unlock"}
        </Button>
      </form>
    </main>
  );
}
