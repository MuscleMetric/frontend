import { supabase } from "@/lib/supabase";
import type { ProgressOverview } from "./progress.types";

export async function fetchProgressOverview(): Promise<ProgressOverview> {
  const { data, error } = await supabase.rpc("get_progress_overview");
  if (error) throw error;
  return data as ProgressOverview;
}
