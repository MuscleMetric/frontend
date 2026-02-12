//features/workouts/live/persist/server.ts
import { supabase } from "@/lib/supabase";
import type { LiveWorkoutDraft } from "../state/types";

/**
 * Server storage is optional but recommended.
 * Uses table: public.live_workout_drafts (see SQL below).
 */

export async function fetchServerDraft(
  userId: string
): Promise<LiveWorkoutDraft | null> {
  const { data, error } = await supabase
    .from("live_workout_drafts")
    .select("draft, updated_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data?.draft) return null;

  const draft = data.draft as LiveWorkoutDraft;

  return {
    ...draft,
    userId,
    updatedAt: data.updated_at ?? draft.updatedAt,
  };
}

export async function clearServerDraft(userId: string): Promise<void> {
  const { error } = await supabase
    .from("live_workout_drafts")
    .delete()
    .eq("user_id", userId);

  if (error) throw error;
}

export async function upsertServerDraft(
  draft: LiveWorkoutDraft
): Promise<void> {
  const { error } = await supabase.from("live_workout_drafts").upsert(
    {
      user_id: draft.userId,
      workout_id: (draft as any).workoutId ?? null,
      plan_workout_id: (draft as any).planWorkoutId ?? null,
      updated_at: draft.updatedAt,
      draft,
    },
    { onConflict: "user_id" }
  );

  if (error) {
    console.log("upsertServerDraft error", error);
    throw error;
  }
}
