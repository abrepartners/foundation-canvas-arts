import { defineTool } from "@lovable.dev/mcp-js";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

export default defineTool({
  name: "list_plants",
  title: "List botanical posts",
  description:
    "List the most recent botanical content posts (plant name, id, virality score, queue status).",
  inputSchema: {
    limit: z
      .number()
      .int()
      .optional()
      .describe("Max rows to return (1-100). Defaults to 25."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }) => {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const cap = Math.min(Math.max(limit ?? 25, 1), 100);
    const { data, error } = await supabase
      .from("botanical_content")
      .select("id, plant_name, virality_score, queue_status, created_at")
      .order("created_at", { ascending: false })
      .limit(cap);
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { items: data ?? [] },
    };
  },
});
