import { useState } from "react";
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

      setContent(data.content);
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

  return { content, isLoading, error, generate, reset };
}
