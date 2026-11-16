import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

/**
 * Client Supabase « service » : contourne la RLS et lit les adresses e-mail des comptes.
 * Serveur uniquement (mails automatiques, tâches planifiées). Ne jamais renvoyer au navigateur
 * une donnée lue avec ce client. Renvoie null si la clé n'est pas configurée.
 */
export function createAdminClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_SECRET;
  if (!url || !key) return null;
  cached ??= createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return cached;
}
