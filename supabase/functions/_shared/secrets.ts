import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function encryptionKey(serviceRoleKey: string): Promise<CryptoKey> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    encoder.encode(`botanical-studio-secret-store|${serviceRoleKey}`),
  );
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

function adminClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRoleKey) throw new Error("Backend secret store is not configured");
  return {
    serviceRoleKey,
    client: createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    }),
  };
}

export async function setStoredSecret(name: string, value: string): Promise<void> {
  const { client, serviceRoleKey } = adminClient();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await encryptionKey(serviceRoleKey),
    encoder.encode(value),
  );
  const { error } = await client.from("app_secrets").upsert({
    name,
    ciphertext: toBase64(new Uint8Array(encrypted)),
    iv: toBase64(iv),
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(`Unable to store ${name}`);
}

export async function getStoredSecret(name: string): Promise<string | null> {
  const environmentValue = Deno.env.get(name);
  if (environmentValue) return environmentValue;

  const { client, serviceRoleKey } = adminClient();
  const { data, error } = await client
    .from("app_secrets")
    .select("ciphertext,iv")
    .eq("name", name)
    .maybeSingle();
  if (error) throw new Error(`Unable to read ${name}`);
  if (!data) return null;

  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromBase64(data.iv) },
      await encryptionKey(serviceRoleKey),
      fromBase64(data.ciphertext),
    );
    return decoder.decode(decrypted);
  } catch {
    throw new Error(`${name} must be reconnected`);
  }
}

export async function getReplicateApiKey(): Promise<string | null> {
  return getStoredSecret("REPLICATE_API_KEY");
}
