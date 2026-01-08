import type { GeneratorInputs, GeneratedContent } from "@/types/generator";
import { supabase } from "@/integrations/supabase/client";

export async function generateContent(inputs: GeneratorInputs): Promise<GeneratedContent> {
  const { data, error } = await supabase.functions.invoke("generate-botanical-content", {
    body: inputs,
  });

  if (error) {
    console.error("Edge function error:", error);
    throw new Error(error.message || "Failed to generate content");
  }

  if (data.error) {
    throw new Error(data.error);
  }

  return data as GeneratedContent;
}
