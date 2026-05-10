import { supabase } from "../supabaseClient.js";

export async function getTariffs() {
  try {
    const { data, error } = await supabase
      .from("tariffs")
      .select("name, title, description")
      .order("name");
    if (error) {
      console.error("[supabase] Failed to read tariffs:", error.message);
      return [];
    }
    return (data || []).map((row) => ({
      name: row.name || row.title,
      description: row.description || "",
    }));
  } catch (error) {
    console.error("[supabase] Failed to read tariffs (network/client error):", {
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}
