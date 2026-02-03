import { createClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client with service role. Use only in server code
 * after verifying the current user is admin (e.g. in app_users).
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey)
    throw new Error("Missing Supabase URL or SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, serviceRoleKey);
}
