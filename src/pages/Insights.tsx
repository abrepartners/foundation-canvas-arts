import { useCallback, useEffect, useMemo, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { invokeFn } from "@/lib/invokeFn";
import { BarChart3, ExternalLink, Loader2, Music2, RefreshCw } from "lucide-react";

interface Publication {
  id: string;
  platform: "tiktok" | "youtube";
  delivery_mode: string;
  status: string;
  title: string | null;
  remote_url: string | null;
  remote_content_id: string | null;
  music_label: string | null;
  created_at: string;
  botanical_content?: { plant_name?: string | null } | null;
}

interface Metric {
  publication_id: string;
  captured_at: string;
  views: number | null;
  engaged_views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  average_view_duration_seconds: number | null;
  average_view_percentage: number | null;
  subscribers_gained: number | null;
  estimated_revenue_usd: number | null;
}

interface Payload {
  connections: {
    tiktok: { open_id: string; scope: string | null; updated_at: string } | null;
    youtube: { account_id: string; account_name: string | null; updated_at: string } | null;
  };
  publications: Publication[];
  metrics: Metric[];
  costs: Array<{ estimated_cost_usd: number; actual_cost_usd: number | null; status: string }>;
}

function compact(value: number | null | undefined) {
  return value == null ? "—" : Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

export default function Insights() {
  const [data, setData] = useState<Payload | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [videoLinks, setVideoLinks] = useState<Record<string, string>>({});
  const [music, setMusic] = useState<Record<string, string>>({});
  const { toast } = useToast();

  const load = useCallback(async (sync = false) => {
    setBusy(sync ? "sync" : "load");
    const { data: result, error } = await invokeFn<Payload>("platform-insights", { body: { action: sync ? "sync" : "status" } });
    setBusy(null);
    if (error) {
      toast({ title: "Insights could not load", description: error.message, variant: "destructive" });
      return;
    }
    if (result) setData(result);
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const connect = async (platform: "tiktok" | "youtube") => {
    setBusy(platform);
    const { data: result, error } = await invokeFn<{ url: string }>("platform-insights", { body: { action: "connect_url", platform } });
    if (error || !result?.url) {
      setBusy(null);
      toast({ title: `${platform} connection could not start`, description: error?.message, variant: "destructive" });
      return;
    }
    window.location.assign(result.url);
  };

  const linkTikTok = async (publicationId: string) => {
    setBusy(publicationId);
    const { error } = await invokeFn("platform-insights", { body: {
      action: "link_tiktok",
      publication_id: publicationId,
      video_url_or_id: videoLinks[publicationId],
      music_label: music[publicationId],
    } });
    setBusy(null);
    if (error) {
      toast({ title: "Published TikTok could not be linked", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "TikTok linked", description: "Its public performance can now be measured." });
    load();
  };

  const markPublished = async (publicationId: string) => {
    setBusy(publicationId);
    const { error } = await invokeFn("platform-insights", { body: {
      action: "mark_published", publication_id: publicationId, music_label: music[publicationId],
    } });
    setBusy(null);
    if (error) {
      toast({ title: "Publication could not be updated", description: error.message, variant: "destructive" });
      return;
    }
    load(true);
  };

  const latestMetrics = useMemo(() => {
    const map = new Map<string, Metric>();
    for (const metric of data?.metrics ?? []) if (!map.has(metric.publication_id)) map.set(metric.publication_id, metric);
    return map;
  }, [data]);
  const confirmedCost = (data?.costs ?? []).reduce((sum, row) => sum + Number(row.actual_cost_usd ?? row.estimated_cost_usd ?? 0), 0);

  return (
    <div className="min-h-screen bg-background">
      <AppHeader title="Publishing & Insights" subtitle="Draft first, publish natively, then learn from the result." contained />
      <main className="container py-6 pb-24 md:pb-8 space-y-6">
        <section className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border bg-card p-4"><p className="text-xs text-muted-foreground">Tracked posts</p><p className="text-2xl font-serif">{data?.publications.length ?? 0}</p></div>
          <div className="rounded-lg border bg-card p-4"><p className="text-xs text-muted-foreground">Measured views</p><p className="text-2xl font-serif">{compact([...latestMetrics.values()].reduce((sum, metric) => sum + Number(metric.views ?? 0), 0))}</p></div>
          <div className="rounded-lg border bg-card p-4"><p className="text-xs text-muted-foreground">Tracked generation cost</p><p className="text-2xl font-serif">${confirmedCost.toFixed(2)}</p></div>
        </section>

        <section className="rounded-lg border bg-card p-4 space-y-4">
          <div className="flex items-center justify-between gap-3"><div><h2 className="font-serif text-lg">Connections</h2><p className="text-xs text-muted-foreground">Tokens are stored only in the backend.</p></div><Button variant="outline" size="sm" disabled={!!busy} onClick={() => load(true)}><RefreshCw className={`h-4 w-4 mr-1 ${busy === "sync" ? "animate-spin" : ""}`} />Sync metrics</Button></div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="rounded-md border p-3 flex items-center justify-between gap-3"><div><p className="font-medium text-sm">TikTok</p><p className="text-xs text-muted-foreground">{data?.connections.tiktok ? "Connected · drafts + public metrics" : "Not connected"}</p></div><Button size="sm" variant={data?.connections.tiktok ? "outline" : "default"} onClick={() => connect("tiktok")} disabled={!!busy}>{busy === "tiktok" && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}{data?.connections.tiktok ? "Reconnect" : "Connect"}</Button></div>
            <div className="rounded-md border p-3 flex items-center justify-between gap-3"><div><p className="font-medium text-sm">YouTube</p><p className="text-xs text-muted-foreground">{data?.connections.youtube ? `Connected · ${data.connections.youtube.account_name ?? "channel"}` : "Not connected"}</p></div><Button size="sm" variant={data?.connections.youtube ? "outline" : "default"} onClick={() => connect("youtube")} disabled={!!busy}>{busy === "youtube" && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}{data?.connections.youtube ? "Reconnect" : "Connect"}</Button></div>
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center gap-2"><BarChart3 className="h-4 w-4" /><h2 className="font-serif text-lg">Post results</h2></div>
          {!data?.publications.length ? <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">Send a TikTok draft or a private YouTube upload to start tracking.</div> : data.publications.map((publication) => {
            const metric = latestMetrics.get(publication.id);
            const needsTikTokLink = publication.platform === "tiktok" && publication.status === "delivered";
            const needsYouTubePublish = publication.platform === "youtube" && publication.status === "delivered";
            return <article key={publication.id} className="rounded-lg border bg-card p-4 space-y-3">
              <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] uppercase tracking-wide text-muted-foreground">{publication.platform} · {publication.delivery_mode}</p><h3 className="font-serif text-lg">{publication.title || publication.botanical_content?.plant_name || "Untitled"}</h3></div><Badge variant="outline" className="capitalize">{publication.status}</Badge></div>
              {metric && <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center"><div><p className="text-lg font-semibold">{compact(metric.views)}</p><p className="text-[10px] text-muted-foreground">Views</p></div><div><p className="text-lg font-semibold">{compact(metric.likes)}</p><p className="text-[10px] text-muted-foreground">Likes</p></div><div><p className="text-lg font-semibold">{compact(metric.comments)}</p><p className="text-[10px] text-muted-foreground">Comments</p></div><div><p className="text-lg font-semibold">{compact(metric.shares)}</p><p className="text-[10px] text-muted-foreground">Shares</p></div><div><p className="text-lg font-semibold">{metric.average_view_percentage == null ? "—" : `${Number(metric.average_view_percentage).toFixed(0)}%`}</p><p className="text-[10px] text-muted-foreground">Avg watched</p></div><div><p className="text-lg font-semibold">{compact(metric.subscribers_gained)}</p><p className="text-[10px] text-muted-foreground">Subscribers</p></div></div>}
              {(needsTikTokLink || needsYouTubePublish) && <div className="rounded-md bg-muted/40 p-3 space-y-2"><p className="text-xs text-muted-foreground">After adding native music and publishing, record it here so the app can learn from the post.</p><div className="grid sm:grid-cols-2 gap-2">{needsTikTokLink && <Input placeholder="Paste the published TikTok URL" value={videoLinks[publication.id] ?? ""} onChange={(e) => setVideoLinks((old) => ({ ...old, [publication.id]: e.target.value }))} />}<Input placeholder="Music / sound used (optional)" value={music[publication.id] ?? ""} onChange={(e) => setMusic((old) => ({ ...old, [publication.id]: e.target.value }))} /></div><Button size="sm" disabled={busy === publication.id || (needsTikTokLink && !videoLinks[publication.id])} onClick={() => needsTikTokLink ? linkTikTok(publication.id) : markPublished(publication.id)}><Music2 className="h-3.5 w-3.5 mr-1" />Mark published</Button></div>}
              {publication.remote_url && <a href={publication.remote_url} target="_blank" rel="noreferrer" className="inline-flex items-center text-xs text-primary hover:underline">Open post <ExternalLink className="h-3 w-3 ml-1" /></a>}
            </article>;
          })}
        </section>
      </main>
    </div>
  );
}
