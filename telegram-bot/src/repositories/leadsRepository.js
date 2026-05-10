import { supabase } from "../supabaseClient.js";

export async function createLead(leadPayload) {
  try {
    const { error } = await supabase.from("leads").insert(leadPayload);
    if (error) {
      console.error("[supabase] Failed to insert lead:", error.message, {
        telegramId: leadPayload.telegram_id,
      });
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[supabase] Failed to insert lead (network/client error):", {
      error: message,
      telegramId: leadPayload.telegram_id,
    });
    return { ok: false, error: message };
  }
}
