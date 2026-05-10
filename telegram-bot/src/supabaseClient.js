import { createClient } from "@supabase/supabase-js";
import { config } from "./config.js";

export const supabase = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

export async function checkSupabaseConnection() {
  try {
    const { error } = await supabase.from("business_types").select("id", { head: true, count: "exact" });
    if (error) {
      console.error("[supabase] Connection check failed while reading business_types:", error.message);
      return false;
    }
    return true;
  } catch (error) {
    console.error("[supabase] Supabase is unavailable. Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.", {
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}
