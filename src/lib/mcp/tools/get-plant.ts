import { defineTool } from "@lovable.dev/mcp-js";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

export default defineTool({
  name: "get_plant",
  title: "Get botanical post",
  description:
    "Fetch a full botanical content row by id, including script, caption, and verified fact.",
  inputSchema: {
    id: z.string().uuid().describe("botanical_content row id (UUID)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ id }) => {
    const env = (globalThis as { Deno?: { env: { get(k: string): string | undefined } } }).Deno?.env;
    const supabase = createClient(
      env?.get("SUPABASE_URL") ?? "",
      env?.get("SUPABASE_PUBLISHABLE_KEY") ?? env?.get("SUPABASE_ANON_KEY") ?? "",
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { data, error } = await supabase
      .from("botanical_content")
      .select(
        "id, plant_name, verified_fact, script, caption, part2_hook, virality_score, score_reasoning, queue_status, created_at",
      )
      .eq("id", id)
      .maybeSingle();
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    if (!data) {
      return { content: [{ type: "text", text: "Not found" }], isError: true };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { row: data },
    };
  },
});
