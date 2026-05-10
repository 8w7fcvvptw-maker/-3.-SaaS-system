import { supabase } from "../supabaseClient.js";

export async function getBusinessTypes() {
  try {
    const { data, error } = await supabase.from("business_types").select("name, title").order("name");
    if (error) {
      console.error("[supabase] Failed to read business_types:", error.message);
      return [];
    }
    return (data || [])
      .map((row) => row.name || row.title)
      .filter(Boolean);
  } catch (error) {
    console.error("[supabase] Failed to read business_types (network/client error):", {
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}
