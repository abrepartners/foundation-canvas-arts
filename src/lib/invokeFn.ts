import { supabase } from "@/integrations/supabase/client";

type InvokeOptions = Parameters<typeof supabase.functions.invoke>[1];

class ProxyFunctionsError extends Error {
  context: Response;

  constructor(response: Response, body: string) {
    super(`Edge Function returned ${response.status}`);
    this.name = "FunctionsHttpError";
    this.context = new Response(body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function invokeFn<T = any>(name: string, options: InvokeOptions = {}) {
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    const endpoint = `${supabaseUrl}/functions/v1/${encodeURIComponent(name)}`;

    const request = async (accessToken?: string | null) => {
      const headers = new Headers(options.headers as HeadersInit | undefined);
      headers.set("Content-Type", "application/json");
      headers.set("apikey", publishableKey);
      headers.set("Authorization", `Bearer ${accessToken || publishableKey}`);
      return fetch(endpoint, {
        method: "POST",
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
      });
    };

    let { data: sessionData } = await supabase.auth.getSession();
    const expiresSoon = sessionData.session?.expires_at
      ? sessionData.session.expires_at * 1000 <= Date.now() + 60_000
      : false;
    if (expiresSoon) {
      const refreshed = await supabase.auth.refreshSession();
      if (!refreshed.error) sessionData = refreshed.data;
    }

    let response = await request(sessionData.session?.access_token);
    if (response.status === 401 && sessionData.session?.refresh_token) {
      const refreshed = await supabase.auth.refreshSession();
      if (!refreshed.error && refreshed.data.session?.access_token) {
        response = await request(refreshed.data.session.access_token);
      }
    }
    const text = await response.text();
    let data: T | null = null;
    if (text) {
      try {
        data = JSON.parse(text) as T;
      } catch {
        data = text as T;
      }
    }
    if (!response.ok) {
      return { data: null, error: new ProxyFunctionsError(response, text) };
    }
    return { data, error: null };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error : new Error(String(error)) };
  }
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
