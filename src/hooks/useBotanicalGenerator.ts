import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { BotanicalContent } from '@/types/botanical';

export function useBotanicalGenerator() {
  const [content, setContent] = useState<BotanicalContent | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setIsGenerating(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('generate-botanical-content');

      if (fnError) {
        throw new Error(fnError.message);
      }

      if (data.error) {
        throw new Error(data.error);
      }

      setContent(data as BotanicalContent);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate content');
    } finally {
      setIsGenerating(false);
    }
  };

  const clear = () => {
    setContent(null);
    setError(null);
  };

  return {
    content,
    isGenerating,
    error,
    generate,
    clear,
  };
}
