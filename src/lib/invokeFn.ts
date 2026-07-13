import { supabase } from "@/integrations/supabase/client";
import { getPasscode } from "./auth";

type InvokeOptions = Parameters<typeof supabase.functions.invoke>[1];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function invokeFn<T = any>(name: string, options: InvokeOptions = {}) {
  const p = getPasscode();
  const headers = {
    ...(options?.headers ?? {}),
    "x-app-passcode": p,
  };
  return supabase.functions.invoke<T>(name, { ...options, headers });
}
