import { invokeFn } from "@/lib/invokeFn";
import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { AppHeader } from "@/components/AppHeader";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  RefreshCw,
  ArrowLeftRight,
  Sparkles,
} from "lucide-react";

interface QueueItem {
  id: string;
  plant_name: string | null;
  verified_fact: string | null;
  caption: string | null;
  script: any;
  virality_score: number | null;
  score_reasoning: string | null;
  hook_variants: string[] | null;
  queue_status: string;
  created_at: string;
}

function parseHook(script: any): string {
  let s = script;
  if (typeof s === "string") {
    try { s = JSON.parse(s); } catch { return ""; }
  }
  return s?.hook ?? "";
}

function captionTitle(caption: string | null): string {
  if (!caption) return "";
  const line = caption.split("\n").find((l) => l.trim().startsWith("**"));
  return line ? line.replace(/\*\*/g, "").trim() : "";
}

function scoreColor(score: number | null) {
  if (score == null) return "bg-muted text-muted-foreground";
  if (score >= 80) return "bg-green-600 text-white";
  if (score >= 60) return "bg-amber-500 text-white";
  return "bg-destructive text-destructive-foreground";
}

export default function Queue() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const fetchItems = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from("botanical_content")
      .select("id, plant_name, verified_fact, caption, script, virality_score, score_reasoning, hook_variants, queue_status, created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    if (filter !== "all") q = q.eq("queue_status", filter);
    const { data, error } = await q;
    if (error) {
      toast({ title: "Failed to load", description: error.message, variant: "destructive" });
    } else {
      setItems((data ?? []) as QueueItem[]);
    }
    setLoading(false);
  }, [filter, toast]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const markBusy = (id: string, on: boolean) => {
    setBusy((prev) => {
      const next = new Set(prev);
      if (on) next.add(id); else next.delete(id);
      return next;
    });
  };

  const setStatus = async (id: string, status: "approved" | "rejected" | "pending") => {
    markBusy(id, true);
    const { error } = await supabase
      .from("botanical_content")
      .update({ queue_status: status })
      .eq("id", id);
    markBusy(id, false);
    if (error) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: status === "approved" ? "Approved" : status === "rejected" ? "Rejected" : "Reset" });
      fetchItems();
    }
  };

  const swapHook = async (item: QueueItem, newHook: string) => {
    markBusy(item.id, true);
    let script = item.script;
    if (typeof script === "string") {
      try { script = JSON.parse(script); } catch { script = {}; }
    }
    const oldHook = script?.hook ?? "";
    const newScript = { ...script, hook: newHook };
    const variants = (item.hook_variants ?? []).filter((v) => v !== newHook);
    if (oldHook) variants.push(oldHook);

    const { error } = await supabase
      .from("botanical_content")
      .update({
        script: JSON.stringify(newScript),
        hook_variants: variants.slice(0, 2),
      })
      .eq("id", item.id);
    markBusy(item.id, false);
    if (error) {
      toast({ title: "Swap failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Hook swapped", description: "Re-scoring…" });
    // Re-score in background.
    await invokeFn("score-content", { body: { content_id: item.id } });
    fetchItems();
  };

  const rescore = async (id: string) => {
    markBusy(id, true);
    const { error } = await invokeFn("score-content", { body: { content_id: id } });
    markBusy(id, false);
    if (error) {
      toast({ title: "Scoring failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Re-scored" });
      fetchItems();
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader
        title="Approval Queue"
        subtitle="Score, swap hooks, approve — then auto-post."
        contained
      />

      <main className="container py-6 space-y-4 pb-24 md:pb-6">
        <div className="flex items-center gap-2 flex-wrap">
          {(["pending", "approved", "rejected", "all"] as const).map((f) => (
            <Button
              key={f}
              variant={filter === f ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(f)}
              className="capitalize"
            >
              {f}
            </Button>
          ))}
          <Button variant="ghost" size="sm" onClick={fetchItems} className="ml-auto">
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-12 text-center text-muted-foreground font-body">
            Nothing in this view.
          </div>
        ) : (
          <div className="grid gap-4">
            {items.map((item) => {
              const hook = parseHook(item.script);
              const title = captionTitle(item.caption) || item.plant_name || "Untitled";
              const variants = item.hook_variants ?? [];
              const isBusy = busy.has(item.id);
              return (
                <div key={item.id} className="rounded-lg border border-border bg-card p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-body">
                        {item.plant_name}
                      </p>
                      <h3 className="font-serif text-lg text-foreground leading-tight">{title}</h3>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className={`px-2.5 py-1 rounded-md text-sm font-semibold ${scoreColor(item.virality_score)}`}>
                        {item.virality_score ?? "—"}
                      </div>
                      <Badge variant="outline" className="capitalize">{item.queue_status}</Badge>
                    </div>
                  </div>

                  {item.score_reasoning && (
                    <p className="text-xs text-muted-foreground font-body italic">
                      {item.score_reasoning}
                    </p>
                  )}

                  <div className="rounded-md border border-border/50 bg-muted/30 p-3">
                    <p className="text-[10px] uppercase tracking-wide text-primary font-body mb-1">Current hook</p>
                    <p className="text-sm text-foreground font-body">{hook || <span className="text-muted-foreground">no hook</span>}</p>
                  </div>

                  {variants.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-body">Alternate hooks</p>
                      {variants.map((v, i) => (
                        <div key={i} className="flex items-start gap-2 rounded-md border border-border/50 p-2">
                          <p className="text-sm text-foreground/90 font-body flex-1">{v}</p>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={isBusy}
                            onClick={() => swapHook(item, v)}
                            className="h-7 px-2 text-xs flex-shrink-0"
                          >
                            <ArrowLeftRight className="h-3 w-3 mr-1" /> Use
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center gap-2 flex-wrap pt-1">
                    {item.queue_status !== "approved" && (
                      <Button size="sm" disabled={isBusy} onClick={() => setStatus(item.id, "approved")}>
                        {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <CheckCircle2 className="h-3.5 w-3.5 mr-1" />}
                        Approve
                      </Button>
                    )}
                    {item.queue_status !== "rejected" && (
                      <Button size="sm" variant="outline" disabled={isBusy} onClick={() => setStatus(item.id, "rejected")}>
                        <XCircle className="h-3.5 w-3.5 mr-1" /> Reject
                      </Button>
                    )}
                    {item.queue_status !== "pending" && (
                      <Button size="sm" variant="ghost" disabled={isBusy} onClick={() => setStatus(item.id, "pending")}>
                        Reset
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" disabled={isBusy} onClick={() => rescore(item.id)}>
                      <Sparkles className="h-3.5 w-3.5 mr-1" /> Re-score
                    </Button>
                    <Link
                      to="/"
                      onClick={() => sessionStorage.setItem("queue:load_id", item.id)}
                      className="text-xs text-muted-foreground hover:text-foreground ml-auto"
                    >
                      Open in editor →
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
