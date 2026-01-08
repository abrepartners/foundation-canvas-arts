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

export interface BotanicalContent {
  plant_name: string;
  verified_fact: string;
  script: ScriptStructure;
  thumbnail_prompt: ThumbnailPrompt;
  caption: string;
  part2_hook: string;
}

export interface SavedContent extends BotanicalContent {
  id: string;
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

      const generatedContent: BotanicalContent = data.content;
      setContent(generatedContent);

      // Save to database with JSON stringified fields
      const { error: insertError } = await supabase
        .from("botanical_content")
        .insert({
          plant_name: generatedContent.plant_name,
          verified_fact: generatedContent.verified_fact,
          script: JSON.stringify(generatedContent.script),
          thumbnail: JSON.stringify(generatedContent.thumbnail_prompt),
          caption: generatedContent.caption,
          part2_hook: generatedContent.part2_hook,
          raw_content: data.raw || "",
        });

      if (insertError) {
        console.error("Failed to save content:", insertError);
      }

      toast({
        title: "Content generated",
        description: `${generatedContent.plant_name} content package is ready.`,
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
      plant_name: saved.plant_name,
      verified_fact: saved.verified_fact,
      script: saved.script,
      thumbnail_prompt: saved.thumbnail_prompt,
      caption: saved.caption,
      part2_hook: saved.part2_hook,
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
        (data || []).map((item) => {
          // Parse JSON strings back to objects
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

          return {
            id: item.id,
            plant_name: item.plant_name || "Unknown Plant",
            verified_fact: item.verified_fact || "",
            script,
            thumbnail_prompt,
            caption: item.caption || "",
            part2_hook: item.part2_hook || "",
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
