// app/features/home/data/starterTemplates.ts
import { supabase } from "../../../../lib/supabase";

export async function cloneStarterTemplate(templateWorkoutId: string): Promise<string> {
  const { data, error } = await supabase.rpc("clone_starter_template", {
    p_template_workout_id: templateWorkoutId,
  });
  if (error) throw error;
  return typeof data === "string" ? data : String(data);
}
