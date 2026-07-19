// Bounded still-recovery poller. Runs for one polling window (~90s). Never
// self-invokes. Manual/automatic invocations are budgeted per row via
// botanical_animated.retry_counts.stills_auto and stills_manual.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeadersFor } from "../_shared/cors.ts";
import { requireAuthorized } from "../_shared/auth.ts";
import { guardedUpdateAnimated } from "../_shared/guardedUpdate.ts";
import { hasActiveProviderJobs } from "../_shared/providerJobs.ts";

const INITIAL_STEPS = [
  { key: "script", label: "Picking plant + writing script", status: "pending" },
  { key: "stills", label: "Preparing 6 hero stills", status: "pending" },
  { key: "clips", label: "Choose one hero still and motion prompt", status: "pending" },
  { key: "save", label: "Save or send the approved clip", status: "pending" },
] as const;

const ORDER = ["hook", "dangle_1", "rehook", "dangle_2", "verified_truth", "close"];
const POLL_ITERATIONS = 30; // 30 * 3s = 90s per invocation
const POLL_INTERVAL_MS = 3000;
const STALE_GENERATING_MS = 60_000;
const MAX_AUTO_RESUMES = 2; // hard cap of automatic image resumes per row
const MAX_MANUAL_RESUMES = 3; // additional manual retries surfaced in the UI

interface Visual {
  moment: string;
  prompt?: string;
  image_url?: string | null;
  status?: string;
  started_at?: string | null;
  error?: string | null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeadersFor(req) });
  const corsHeaders = corsHeadersFor(req);
  const auth = await requireAuthorized(req);
  if (!auth.ok) return auth.response;

  const json = (payload: unknown, status = 200) =>
    new Response(JSON.stringify(payload), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SERVICE);

    const body = await req.json().catch(() => ({}));
    const rowId: string | undefined = body?.row_id;
    const manual: boolean = body?.manual === true;
    if (!rowId) return json({ success: false, error: "row_id required" }, 400);

    const { data: animatedRow, error: rErr } = await supabase
      .from("botanical_animated")
      .select("source_content_id, plant_name, queue_status, stop_requested_at")
      .eq("id", rowId)
      .single();
    if (rErr || !animatedRow?.source_content_id) {
      return json({ success: false, error: rErr?.message ?? "row missing source_content_id" }, 404);
    }
    if (animatedRow.stop_requested_at || ["canceled", "done", "error"].includes(animatedRow.queue_status)) {
      return json({ success: false, error: `row is ${animatedRow.queue_status}` }, 409);
    }

    // Atomic retry-budget consumption via SQL RPC — race-free across callers.
    const bucket = manual ? "stills_manual" : "stills_auto";
    const limitValue = manual ? MAX_MANUAL_RESUMES : MAX_AUTO_RESUMES;
    const { data: rpcRows, error: rpcErr } = await supabase.rpc("consume_animation_retry", {
      _row_id: rowId,
      _bucket: bucket,
      _limit_value: limitValue,
    });
    if (rpcErr) return json({ success: false, error: rpcErr.message }, 500);
    const rpcRow = Array.isArray(rpcRows) ? rpcRows[0] : rpcRows;
    if (!rpcRow?.allowed) {
      return json({
        success: false,
        error: "retry_budget_exhausted",
        bucket,
        used: rpcRow?.used ?? 0,
        limit: rpcRow?.limit_value ?? limitValue,
      }, 429);
    }

    const sourceId = animatedRow.source_content_id as string;
    const plantName = animatedRow.plant_name as string | null;

    const bg = async () => {
      try {
        let resumeFired = false;

        for (let i = 0; i < POLL_ITERATIONS; i++) {
          await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

          // Recheck stop each iteration.
          const { data: state } = await supabase
            .from("botanical_animated")
            .select("stop_requested_at, queue_status")
            .eq("id", rowId)
            .maybeSingle();
          if (!state || state.stop_requested_at || ["canceled", "done", "error"].includes(state.queue_status)) {
            return;
          }

          const { data: src } = await supabase
            .from("botanical_content")
            .select("script_visuals")
            .eq("id", sourceId)
            .single();
          if (!src?.script_visuals) continue;

          let visuals: Visual[] = [];
          try {
            visuals = typeof src.script_visuals === "string"
              ? JSON.parse(src.script_visuals as string)
              : (src.script_visuals as Visual[]);
          } catch { continue; }

          const ordered = ORDER.map((m) => visuals.find((v) => v.moment === m)).filter(Boolean) as Visual[];
          const doneCount = ordered.filter((v) => v.image_url && v.status === "done").length;
          const stillUrls = ordered.map((v) => v.image_url || "");

          const progressApplied = await guardedUpdateAnimated(supabase, rowId, {
            still_urls: stillUrls,
            progress: {
              stage: "stills",
              steps: INITIAL_STEPS.map((s) => {
                if (s.key === "script") return { ...s, status: "done", detail: plantName ?? "" };
                if (s.key === "stills") return { ...s, status: doneCount === 6 ? "done" : "running", detail: `${doneCount} / 6` };
                return s;
              }),
            },
          });
          if (!progressApplied) return;

          if (doneCount === 6 && ordered.every((v) => v.image_url)) {
            await guardedUpdateAnimated(supabase, rowId, {
              queue_status: "stills_ready",
              progress: {
                stage: "review",
                steps: INITIAL_STEPS.map((s) => {
                  if (s.key === "script") return { ...s, status: "done", detail: plantName ?? "" };
                  if (s.key === "stills") return { ...s, status: "done", detail: "6 / 6" };
                  return s;
                }),
              },
            });
            return;
          }

          // Fire the recovery function once per invocation for stuck slots.
          const now = Date.now();
          const hasStuck = ordered.some((v) => {
            if (v.status === "done" && v.image_url) return false;
            if (v.status === "error") return true;
            if (v.status === "generating") {
              const t = v.started_at ? Date.parse(v.started_at) : 0;
              return !t || now - t > STALE_GENERATING_MS;
            }
            return !v.image_url;
          });
          if (hasStuck && !resumeFired) {
            resumeFired = true;
            supabase.functions.invoke("generate-botanical-resume", {
              body: { content_id: sourceId, image_provider: "openai", animation_row_id: rowId },
            }).catch((e) => console.warn("resume invoke failed:", e));
          }
        }

        // Do NOT self-chain. Client decides whether to invoke again (manual).
        console.log(`animated-start-resume: window closed for ${rowId} (${bucket}=${rpcRow.used})`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("animated-start-resume bg error:", msg);
        const providerStillActive = await hasActiveProviderJobs(supabase, rowId);
        await guardedUpdateAnimated(supabase, rowId, {
          ...(providerStillActive ? {} : { queue_status: "error" }),
          error: msg,
        });
      }
    };

    // @ts-expect-error EdgeRuntime is provided by the Supabase edge runtime
    if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) {
      // @ts-expect-error EdgeRuntime is provided by the Supabase edge runtime
      EdgeRuntime.waitUntil(bg());
    } else { bg(); }

    return json({ success: true, bucket, used: rpcRow.used, limit: rpcRow.limit_value }, 202);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return json({ success: false, error: msg }, 500);
  }
});
