import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

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

export interface FacelessVisual {
  moment: "hook" | "dangle_1" | "rehook" | "dangle_2" | "verified_truth" | "close";
  prompt: string;
  image_url?: string | null;
  error?: string | null;
  history?: VisualHistoryEntry[];
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
  const { toast } = useToast();

  const pollForImages = async (contentId: string) => {
    const MAX_POLLS = 180;
    const INTERVAL_MS = 2000;

    for (let i = 0; i < MAX_POLLS; i++) {
      await new Promise((r) => setTimeout(r, INTERVAL_MS));

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
      } catch {
        continue;
      }

      setContent((prev) => (prev && prev.id === contentId ? { ...prev, faceless_visuals: visuals } : prev));

      if (visuals.length > 0 && visuals.every((v) => v.image_url || v.error)) {
        return;
      }
    }
  };

  const generate = async (_imageProvider: "lovable" | "replicate" = "replicate") => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke(
        "generate-botanical-content",
        { body: { image_provider: "replicate" } }
      );

      if (fnError) throw new Error(fnError.message);
      if (!data.success) throw new Error(data.error || "Failed to generate content");

      const generatedContent: ContentWithId = {
        ...data.content,
        id: data.content_id,
      };
      setContent(generatedContent);

      toast({
        title: "Content generated",
        description: `${generatedContent.plant_name} — images generating in background.`,
      });

      pollForImages(data.content_id);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      toast({
        title: "Generation failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const regenerateVisual = async (
    moment: string,
    _imageProvider: "lovable" | "replicate" = "replicate",
    options: { silent?: boolean } = {}
  ) => {
    if (!content?.id) {
      toast({ title: "Cannot regenerate", description: "No content ID available", variant: "destructive" });
      return null;
    }

    try {
      const { data, error: fnError } = await supabase.functions.invoke(
        "regenerate-visual",
        {
          body: {
            content_id: content.id,
            moment,
            image_provider: "replicate",
          },
        }
      );

      if (fnError) throw new Error(fnError.message);
      if (!data.success) throw new Error(data.error || "Failed to regenerate image");

      setContent((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          faceless_visuals: prev.faceless_visuals.map((v) =>
            v.moment === moment
              ? { ...v, image_url: data.image_url, prompt: data.prompt ?? v.prompt, error: null, history: data.history ?? v.history }
              : v
          ),
        };
      });

      if (!options.silent) {
        toast({ title: "Image regenerated", description: `${moment} visual updated.` });
      }

      return data.image_url;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      toast({ title: "Regeneration failed", description: message, variant: "destructive" });
      return null;
    }
  };

  const regenerateAllVisuals = async (_imageProvider: "lovable" | "replicate" = "replicate") => {
    const moments = ["hook", "dangle_1", "rehook", "dangle_2", "verified_truth", "close"];
    for (const m of moments) {
      await regenerateVisual(m, "replicate", { silent: true });
    }
    toast({ title: "All visuals regenerated", description: "Refreshed with the latest plate style." });
  };

  const restoreVisualVersion = async (
    moment: string,
    entry: VisualHistoryEntry
  ) => {
    if (!content?.id) return null;
    try {
      const { data, error: fnError } = await supabase.functions.invoke(
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
      if (fnError) throw new Error(fnError.message);
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
  };

  const loadFromHistory = (saved: SavedContent) => {
    setContent({
      id: saved.id,
      plant_name: saved.plant_name,
      verified_fact: saved.verified_fact,
      script: saved.script,
      thumbnail_prompt: saved.thumbnail_prompt,
      caption: saved.caption,
      part2_hook: saved.part2_hook,
      faceless_visuals: saved.faceless_visuals,
    });
  };

  const [isRegeneratingCaption, setIsRegeneratingCaption] = useState(false);
  const regenerateCaption = async () => {
    if (!content?.id) {
      toast({ title: "Cannot regenerate", description: "No content ID available", variant: "destructive" });
      return null;
    }
    setIsRegeneratingCaption(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke(
        "regenerate-caption",
        { body: { table: "botanical_content", id: content.id } },
      );
      if (fnError) throw new Error(fnError.message);
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

  return { content, isLoading, error, generate, reset, loadFromHistory, regenerateVisual, regenerateAllVisuals, restoreVisualVersion, regenerateCaption, isRegeneratingCaption };
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
      .limit(50);

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
    const { error } = await supabase
      .from("botanical_content")
      .delete()
      .eq("id", id);

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
