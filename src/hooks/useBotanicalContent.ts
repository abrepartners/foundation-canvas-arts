import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface BotanicalContent {
  script: string;
  thumbnail: string;
  caption: string;
  part2Hook: string;
  scriptVisuals: string;
  raw?: string;
}

export interface SavedContent extends BotanicalContent {
  id: string;
  plant_name: string | null;
  created_at: string;
}

export function useBotanicalContent() {
  const [content, setContent] = useState<BotanicalContent | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const generate = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke(
        "generate-botanical-content"
      );

      if (fnError) {
        throw new Error(fnError.message);
      }

      if (!data.success) {
        throw new Error(data.error || "Failed to generate content");
      }

      const generatedContent = data.content;
      setContent(generatedContent);

      // Extract plant name from script (first mentioned plant)
      const plantMatch = generatedContent.script?.match(/\b([A-Z][a-z]+ ?[a-z]*)\b/);
      const plantName = plantMatch ? plantMatch[1] : null;

      // Save to database
      const { error: insertError } = await supabase
        .from("botanical_content")
        .insert({
          plant_name: plantName,
          script: generatedContent.script || "",
          thumbnail: generatedContent.thumbnail || "",
          caption: generatedContent.caption || "",
          part2_hook: generatedContent.part2Hook || "",
          script_visuals: generatedContent.scriptVisuals || "",
          raw_content: data.raw || "",
        });

      if (insertError) {
        console.error("Failed to save content:", insertError);
      }

      toast({
        title: "Content generated",
        description: "Your botanical content package is ready.",
      });
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

  const reset = () => {
    setContent(null);
    setError(null);
  };

  const loadFromHistory = (saved: SavedContent) => {
    setContent({
      script: saved.script,
      thumbnail: saved.thumbnail,
      caption: saved.caption,
      part2Hook: saved.part2Hook,
      scriptVisuals: saved.scriptVisuals,
    });
  };

  return { content, isLoading, error, generate, reset, loadFromHistory };
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
        (data || []).map((item) => ({
          id: item.id,
          plant_name: item.plant_name,
          script: item.script,
          thumbnail: item.thumbnail || "",
          caption: item.caption || "",
          part2Hook: item.part2_hook || "",
          scriptVisuals: item.script_visuals || "",
          created_at: item.created_at,
        }))
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
      toast({
        title: "Delete failed",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setHistory((prev) => prev.filter((item) => item.id !== id));
      toast({
        title: "Deleted",
        description: "Content removed from history.",
      });
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  return { history, isLoading, refetch: fetchHistory, deleteItem };
}
