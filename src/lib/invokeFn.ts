import { supabase } from "@/integrations/supabase/client";
import { APP_PASSCODE } from "@/lib/passcode";

type InvokeOptions = Parameters<typeof supabase.functions.invoke>[1];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function invokeFn<T = any>(name: string, options: InvokeOptions = {}) {
  return supabase.functions.invoke<T>(name, {
    ...options,
    headers: {
      ...(options.headers || {}),
      "x-app-passcode": APP_PASSCODE,
    },
  });
}

// supabase-js hides the response body on non-2xx status in its `error` object.
// Callers that need to read a structured error payload (e.g. 409 active_run,
// 402 cost_confirmation_required) should pass the caught error here to get
// back { status, body }.
export async function readFnError(
  err: unknown,
): Promise<{ status: number | null; body: unknown }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyErr = err as any;
  const ctx: Response | undefined = anyErr?.context;
  if (!ctx || typeof ctx.text !== "function") {
    return { status: anyErr?.status ?? null, body: { error: anyErr?.message ?? String(err) } };
  }
  const status = ctx.status;
  const text = await ctx.text().catch(() => "");
  try {
    return { status, body: text ? JSON.parse(text) : null };
  } catch {
    return { status, body: text };
  }
}
