import { invokeFn, readFnError } from "@/lib/invokeFn";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export function formatGatewayError(
  raw: string,
  fallbackTitle: string,
): { title: string; message: string } {
  if (/REPLICATE_API_KEY not configured|replicate.*not connected/i.test(raw)) {
    return {
      title: "Replicate is not connected",
      message: "Open Settings, connect your Replicate API token, then try again.",
    };
  }
  if (/payment required|insufficient.*credit|\b402\b/i.test(raw)) {
    return {
      title: "Replicate billing needs attention",
      message: "Add billing or credit to your Replicate account, then try again.",
    };
  }
  if (/unauthorized|invalid.*token|\b401\b|\b403\b/i.test(raw)) {
    return {
      title: "Reconnect Replicate",
      message: "The Replicate token was rejected. Replace it in Settings and try again.",
    };
  }
  if (/RATE_LIMIT/i.test(raw) || /\b429\b/.test(raw)) {
    return {
      title: "Replicate rate limit reached",
      message: "Wait a minute, then try again. Existing image jobs will continue to be checked.",
    };
  }
  return { title: fallbackTitle, message: raw };
}

async function invokeErrorMessage(error: unknown): Promise<string> {
  const detail = await readFnError(error);
  if (detail.body && typeof detail.body === "object" && "error" in detail.body) {
    const message = (detail.body as { error?: unknown }).error;
    if (typeof message === "string" && message.trim()) return message;
  }
  return error instanceof Error ? error.message : "Unknown error";
}

export interface ScriptStructure {
  hook: string;
  dangle_1: string;
  rehook: string;
  dangle_2: string;
  payoff: string;
  verified_truth: string;
  close: string;
}

export interface ThumbnailPrompt {
  mode: "light" | "dark";
  prompt: string;
}

export interface VisualHistoryEntry {
  image_url: string;
  prompt: string;
  created_at: string;
}

export type VisualStatus = "queued" | "generating" | "done" | "error";

export const VISUAL_STALE_MS = 10 * 60 * 1000;
export const INTERRUPTED_VISUAL_MESSAGE =
  "Generation was interrupted before an image was saved. Retry this image.";

export interface FacelessVisual {
  moment: "hook" | "dangle_1" | "rehook" | "dangle_2" | "verified_truth" | "close";
  prompt: string;
  image_url?: string | null;
  error?: string | null;
  history?: VisualHistoryEntry[];
  status?: VisualStatus;
  started_at?: string | null;
  completed_at?: string | null;
  prediction_id?: string | null;
  provider?: "replicate" | "openai" | null;
}

export function normalizeVisual(visual: FacelessVisual, now = Date.now()): FacelessVisual {
  if (visual.image_url) {
    return { ...visual, status: "done", error: null };
  }

  if (visual.status === "generating") {
    const startedAt = visual.started_at ? Date.parse(visual.started_at) : 0;
    if (startedAt > 0 && now - startedAt >= VISUAL_STALE_MS) {
      return {
        ...visual,
        status: "error",
        error: visual.error || INTERRUPTED_VISUAL_MESSAGE,
      };
    }
  }

  return visual;
}

export function normalizeVisuals(visuals: FacelessVisual[], now = Date.now()) {
  return visuals.map((visual) => normalizeVisual(visual, now));
}


export interface BotanicalContent {
  plant_name: string;
  verified_fact: string;
  script: ScriptStructure;
  thumbnail_prompt: ThumbnailPrompt;
  caption: string;
  part2_hook: string;
  faceless_visuals: FacelessVisual[];
}

export interface SavedContent extends BotanicalContent {
  id: string;
  created_at: string;
}

export interface ContentWithId extends BotanicalContent {
  id: string;
}

export function useBotanicalContent() {
  const [content, setContent] = useState<ContentWithId | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoResumeExhausted, setAutoResumeExhausted] = useState(false);
  const [isRetryingStuck, setIsRetryingStuck] = useState(false);
  const [activeContentId, setActiveContentId] = useState<string | null>(null);
  const [activeProvider, setActiveProvider] = useState<"replicate" | "openai">("replicate");
  const { toast } = useToast();

  const MAX_AUTO_RESUMES = 1;

  const pollForImages = async (
    contentId: string,
    imageProvider: "replicate" | "openai" = "replicate",
  ) => {
    const INTERVAL_MS = 2000;
    const MAX_POLLS = 450; // ~15 min ceiling
    const RESUME_AFTER_POLLS = 300; // wait ~10 min before one recovery attempt
    const RESUME_COOLDOWN_MS = 90_000;
    const STALL_MS = VISUAL_STALE_MS;
    let lastResumeAt = 0;
    let autoResumeCount = 0;

    for (let i = 0; i < MAX_POLLS; i++) {
      await new Promise((r) => setTimeout(r, INTERVAL_MS));

      // Pause work while the tab is hidden — avoids background Replicate calls.
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        continue;
      }

      const { data, error: dbError } = await supabase
        .from("botanical_content")
        .select("script_visuals")
        .eq("id", contentId)
        .single();

      if (dbError || !data?.script_visuals) continue;

      let visuals: FacelessVisual[] = [];
      try {
        visuals = typeof data.script_visuals === "string"
          ? JSON.parse(data.script_visuals)
          : data.script_visuals;
        visuals = normalizeVisuals(visuals);
      } catch {
        continue;
      }

      setContent((prev) => (prev && prev.id === contentId ? { ...prev, faceless_visuals: visuals } : prev));

      const allSettled =
        visuals.length > 0 &&
        visuals.every(
          (v) => v.status === "done" || v.status === "error" || v.image_url || v.error,
        );
      if (allSettled) return;

      const now = Date.now();
      const hasStuckSlot = visuals.some((v) => {
        if (v.status === "error" || v.error) return true;
        if (v.status !== "generating" || v.image_url) return false;
        const startedAt = v.started_at ? Date.parse(v.started_at) : 0;
        return startedAt > 0 && now - startedAt > STALL_MS;
      });

      if (
        autoResumeCount < MAX_AUTO_RESUMES &&
        i >= RESUME_AFTER_POLLS &&
        now - lastResumeAt > RESUME_COOLDOWN_MS &&
        hasStuckSlot
      ) {
        lastResumeAt = now;
        autoResumeCount++;
        invokeFn("generate-botanical-resume", {
          body: { content_id: contentId, image_provider: imageProvider },
        }).catch((e) => console.warn("resume invoke failed", e));
        if (autoResumeCount >= MAX_AUTO_RESUMES) {
          setAutoResumeExhausted(true);
        }
      }
    }
  };

  const retryStuck = async () => {
    if (!activeContentId) return;
    setIsRetryingStuck(true);
    try {
      const { error: fnError } = await invokeFn("generate-botanical-resume", {
        body: { content_id: activeContentId, image_provider: activeProvider },
      });
      if (fnError) throw new Error(await invokeErrorMessage(fnError));
      toast({ title: "Retrying stuck images", description: "Kicked off a fresh attempt for pending slots." });
      void pollForImages(activeContentId, activeProvider);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      toast({ title: "Retry failed", description: msg, variant: "destructive" });
    } finally {
      setIsRetryingStuck(false);
    }
  };

  const generate = async (imageProvider: "replicate" | "openai" = "replicate") => {
    setIsLoading(true);
    setError(null);
    setAutoResumeExhausted(false);

    try {
      const { data, error: fnError } = await invokeFn(
        "generate-botanical-content",
        { body: { image_provider: imageProvider } }
      );

      if (fnError) throw new Error(await invokeErrorMessage(fnError));
      if (!data.success) throw new Error(data.error || "Failed to generate content");

      const generatedContent: ContentWithId = {
        ...data.content,
        id: data.content_id,
      };
      setContent(generatedContent);
      setActiveContentId(data.content_id);
      setActiveProvider(imageProvider);

      toast({
        title: "Content generated",
        description: `${generatedContent.plant_name} — images generating in background.`,
      });

      pollForImages(data.content_id, imageProvider);

    } catch (err) {
      const raw = err instanceof Error ? err.message : "Unknown error";
      const { title, message } = formatGatewayError(raw, "Generation failed");
      setError(message);
      toast({
        title,
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const regenerateVisual = async (
    moment: string,
    imageProvider: "replicate" | "openai" = "replicate",
    options: { silent?: boolean } = {}
  ) => {
    if (!content?.id) {
      toast({ title: "Cannot regenerate", description: "No content ID available", variant: "destructive" });
      return null;
    }

    // Optimistic: flag this slot as generating immediately so the UI
    // disables its button even before the edge function writes status.
    setContent((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        faceless_visuals: prev.faceless_visuals.map((v) =>
          v.moment === moment
            ? { ...v, status: "generating", error: null, started_at: new Date().toISOString() }
            : v,
        ),
      };
    });

    try {
      const { data, error: fnError } = await invokeFn(
        "regenerate-visual",
        {
          body: {
            content_id: content.id,
            moment,
            image_provider: imageProvider,
          },
        }
      );

      if (fnError) throw new Error(await invokeErrorMessage(fnError));
      if (!data.success) throw new Error(data.error || "Failed to regenerate image");

      setContent((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          faceless_visuals: prev.faceless_visuals.map((v) =>
            v.moment === moment
              ? { ...v, image_url: data.image_url, prompt: data.prompt ?? v.prompt, error: null, status: "done", history: data.history ?? v.history }
              : v
          ),
        };
      });

      if (!options.silent) {
        toast({ title: "Image regenerated", description: `${moment} visual updated.` });
      }

      return data.image_url;
    } catch (err) {
      const raw = err instanceof Error ? err.message : "Unknown error";
      const { title, message } = formatGatewayError(raw, "Regeneration failed");
      setContent((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          faceless_visuals: prev.faceless_visuals.map((v) =>
            v.moment === moment ? { ...v, status: "error", error: message } : v,
          ),
        };
      });
      toast({ title, description: message, variant: "destructive" });
      return null;
    }
  };

  const regenerateAllVisuals = async (imageProvider: "replicate" | "openai" = "replicate") => {
    const moments = ["hook", "dangle_1", "rehook", "dangle_2", "verified_truth", "close"];
    for (const m of moments) {
      await regenerateVisual(m, imageProvider, { silent: true });
    }
    toast({ title: "All visuals regenerated", description: "Refreshed with the latest plate style." });
  };

  const restoreVisualVersion = async (
    moment: string,
    entry: VisualHistoryEntry
  ) => {
    if (!content?.id) return null;
    try {
      const { data, error: fnError } = await invokeFn(
        "regenerate-visual",
        {
          body: {
            content_id: content.id,
            moment,
            action: "restore",
            image_url: entry.image_url,
            prompt: entry.prompt,
          },
        }
      );
      if (fnError) throw new Error(await invokeErrorMessage(fnError));
      if (!data.success) throw new Error(data.error || "Failed to restore version");

      setContent((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          faceless_visuals: prev.faceless_visuals.map((v) =>
            v.moment === moment
              ? { ...v, image_url: data.image_url, prompt: data.prompt, error: null, history: data.history ?? [] }
              : v
          ),
        };
      });

      toast({ title: "Version restored", description: `${moment} reverted.` });
      return data.image_url;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      toast({ title: "Restore failed", description: message, variant: "destructive" });
      return null;
    }
  };

  const reset = () => {
    setContent(null);
    setError(null);
    setActiveContentId(null);
    setAutoResumeExhausted(false);
  };

  const loadFromHistory = (saved: SavedContent) => {
    const normalizedVisuals = normalizeVisuals(saved.faceless_visuals);
    setContent({
      id: saved.id,
      plant_name: saved.plant_name,
      verified_fact: saved.verified_fact,
      script: saved.script,
      thumbnail_prompt: saved.thumbnail_prompt,
      caption: saved.caption,
      part2_hook: saved.part2_hook,
      faceless_visuals: normalizedVisuals,
    });
    setActiveContentId(saved.id);
    setAutoResumeExhausted(false);
    if (normalizedVisuals.some((visual) => !visual.image_url && visual.status !== "error")) {
      void pollForImages(saved.id, activeProvider);
    }
  };

  const [isRegeneratingCaption, setIsRegeneratingCaption] = useState(false);
  const regenerateCaption = async () => {
    if (!content?.id) {
      toast({ title: "Cannot regenerate", description: "No content ID available", variant: "destructive" });
      return null;
    }
    setIsRegeneratingCaption(true);
    try {
      const { data, error: fnError } = await invokeFn(
        "regenerate-caption",
        { body: { table: "botanical_content", id: content.id } },
      );
      if (fnError) throw new Error(await invokeErrorMessage(fnError));
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      const newCaption = (data as { caption?: string })?.caption ?? "";
      if (!newCaption) throw new Error("Empty caption");
      setContent((prev) => (prev ? { ...prev, caption: newCaption } : prev));
      toast({ title: "Caption regenerated", description: "Updated to the SEO long-form caption." });
      return newCaption;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      toast({ title: "Caption regeneration failed", description: message, variant: "destructive" });
      return null;
    } finally {
      setIsRegeneratingCaption(false);
    }
  };

  return {
    content,
    isLoading,
    error,
    generate,
    reset,
    loadFromHistory,
    regenerateVisual,
    regenerateAllVisuals,
    restoreVisualVersion,
    regenerateCaption,
    isRegeneratingCaption,
    autoResumeExhausted,
    retryStuck,
    isRetryingStuck,
  };
}

export function useContentHistory() {
  const [history, setHistory] = useState<SavedContent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchHistory = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("botanical_content")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) {
      console.error("Failed to fetch history:", error);
    } else {
      setHistory(
        (data || []).map((item) => {
          let script: ScriptStructure;
          let thumbnail_prompt: ThumbnailPrompt;
          
          try {
            script = typeof item.script === 'string' ? JSON.parse(item.script) : item.script;
          } catch {
            script = {
              hook: "",
              dangle_1: "",
              rehook: "",
              dangle_2: "",
              payoff: "",
              verified_truth: "",
              close: "",
            };
          }
          
          try {
            thumbnail_prompt = typeof item.thumbnail === 'string' ? JSON.parse(item.thumbnail) : item.thumbnail;
          } catch {
            thumbnail_prompt = { mode: "light", prompt: item.thumbnail || "" };
          }

          let faceless_visuals: FacelessVisual[] = [];
          try {
            if (item.script_visuals) {
              faceless_visuals = typeof item.script_visuals === 'string' 
                ? JSON.parse(item.script_visuals) 
                : item.script_visuals;
              faceless_visuals = normalizeVisuals(faceless_visuals);
            }
          } catch {
            faceless_visuals = [];
          }

          return {
            id: item.id,
            plant_name: item.plant_name || "Unknown Plant",
            verified_fact: item.verified_fact || "",
            script,
            thumbnail_prompt,
            caption: item.caption || "",
            part2_hook: item.part2_hook || "",
            faceless_visuals,
            created_at: item.created_at,
          };
        })
      );
    }
    setIsLoading(false);
  };

  const deleteItem = async (id: string) => {
    const { error } = await invokeFn("queue-moderation", {
      body: { id, action: "delete" },
    });

    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    } else {
      setHistory((prev) => prev.filter((item) => item.id !== id));
      toast({ title: "Deleted", description: "Content removed from history." });
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  return { history, isLoading, refetch: fetchHistory, deleteItem };
}
