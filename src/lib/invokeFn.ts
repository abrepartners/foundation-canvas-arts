import { supabase } from "@/integrations/supabase/client";
import { getPasscode } from "./auth";

type InvokeOptions = Parameters<typeof supabase.functions.invoke>[1];

export function invokeFn<T = unknown>(name: string, options: InvokeOptions = {}) {
  const p = getPasscode();
  const headers = {
    ...(options?.headers ?? {}),
    "x-app-passcode": p,
  };
  return supabase.functions.invoke<T>(name, { ...options, headers });
}
