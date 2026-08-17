import { useCallback, useEffect, useState, type FormEvent } from "react";
import { CheckCircle2, ExternalLink, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { invokeFn, readFnError } from "@/lib/invokeFn";

interface ReplicateStatus {
  connected?: boolean;
  username?: string | null;
  needs_reconnect?: boolean;
  error?: string;
}

function errorMessage(body: unknown, fallback: string) {
  if (body && typeof body === "object" && "error" in body) {
    const value = (body as { error?: unknown }).error;
    if (typeof value === "string" && value.trim()) return value;
  }
  return fallback;
}

export default function Settings() {
  const [status, setStatus] = useState<ReplicateStatus | null>(null);
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: fnError } = await invokeFn<ReplicateStatus>("configure-replicate", {
      body: { action: "status" },
    });
    setLoading(false);
    if (fnError) {
      const detail = await readFnError(fnError);
      setError(errorMessage(detail.body, "Replicate status could not be checked."));
      return;
    }
    setStatus(data ?? { connected: false });
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const connect = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const submittedToken = token.trim();
    const { data, error: fnError } = await invokeFn<ReplicateStatus>("configure-replicate", {
      body: { action: "connect", token: submittedToken },
    });
    setSaving(false);
    if (fnError) {
      const detail = await readFnError(fnError);
      setError(errorMessage(detail.body, "Replicate could not be connected."));
      return;
    }
    setToken("");
    setStatus(data ?? { connected: true });
    toast({
      title: "Replicate connected",
      description: "The Botanical Content Generator is ready to use your account.",
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader
        title="Settings"
        subtitle="Private connections for Botanical Studio."
        contained
      />
      <main className="container max-w-3xl py-6 pb-24 md:pb-8 space-y-6">
        <Card>
          <CardHeader className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1.5">
                <CardTitle className="flex items-center gap-2 font-serif">
                  <KeyRound className="h-5 w-5" />
                  Replicate API
                </CardTitle>
                <CardDescription>
                  Powers the captions and botanical plate images in the generator.
                </CardDescription>
              </div>
              {loading ? (
                <Badge variant="outline" className="gap-1.5">
                  <Loader2 className="h-3 w-3 animate-spin" /> Checking
                </Badge>
              ) : status?.connected ? (
                <Badge className="gap-1.5 bg-green-700 hover:bg-green-700">
                  <CheckCircle2 className="h-3 w-3" /> Connected
                </Badge>
              ) : (
                <Badge variant="secondary">Not connected</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {status?.connected && (
              <Alert>
                <ShieldCheck className="h-4 w-4" />
                <AlertTitle>Connection verified</AlertTitle>
                <AlertDescription>
                  {status.username
                    ? `Connected to the Replicate account “${status.username}”.`
                    : "Your Replicate token is valid and ready."}
                </AlertDescription>
              </Alert>
            )}

            {status?.needs_reconnect && (
              <Alert variant="destructive">
                <AlertTitle>Reconnect Replicate</AlertTitle>
                <AlertDescription>
                  The saved token is no longer valid. Create a replacement and save it below.
                </AlertDescription>
              </Alert>
            )}

            {error && (
              <Alert variant="destructive">
                <AlertTitle>Connection error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={connect} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="replicate-token">
                  {status?.connected ? "Replace API token" : "API token"}
                </Label>
                <Input
                  id="replicate-token"
                  type="password"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="r8_…"
                  value={token}
                  onChange={(event) => setToken(event.target.value)}
                  minLength={20}
                  maxLength={256}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  The token is sent directly to the private backend, verified with Replicate, and stored encrypted. It is never shown again.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button type="submit" disabled={saving || token.trim().length < 20}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {status?.connected ? "Replace token" : "Connect Replicate"}
                </Button>
                <Button asChild type="button" variant="outline">
                  <a href="https://replicate.com/account/api-tokens" target="_blank" rel="noreferrer">
                    Open Replicate tokens
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </a>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <section className="rounded-lg border bg-card p-5 space-y-2">
          <h2 className="font-serif text-lg">What this connection controls</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            The Botanical Content Generator creates the plant fact package, structured script, caption, thumbnail prompt, and six moment-specific visual prompts. Replicate renders each 9:16 botanical study plate and handles retries or visual regeneration.
          </p>
        </section>
      </main>
    </div>
  );
}
