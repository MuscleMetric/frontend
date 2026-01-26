import { supabase } from "../../../../../lib/supabase";
import type { WorkoutDraft } from "../state/types";

type CreateWorkoutResult = {
  workoutId: string;
};

function assertUser(userId: string | null | undefined) {
  if (!userId) throw new Error("Missing user session");
}

/**
 * Creates a "loose workout" (not plan-bound):
 * - inserts into workouts
 * - inserts ordered workout_exercises rows
 *
 * Assumes tables:
 * - workouts: id, user_id, title, notes, is_favourite, created_at
 * - workout_exercises: workout_id, exercise_id, order_index, note? (optional)
 */
export async function createWorkoutFromDraft(
  userId: string | null | undefined,
  draft: WorkoutDraft
): Promise<CreateWorkoutResult> {
  assertUser(userId);

  const title = String(draft.title ?? "").trim();
  if (!title) throw new Error("Workout name is required");

  // 1) create workout
  const { data: wRow, error: wErr } = await supabase
    .from("workouts")
    .insert({
      user_id: userId,
      title,
      notes: draft.note ?? null,
      is_favourite: !!draft.isFavourite,
    })
    .select("id")
    .single();

  if (wErr) throw wErr;

  const workoutId = String((wRow as any).id);

  // 2) add workout exercises (ordered)
  if (draft.exercises.length) {
    const rows = draft.exercises.map((e, idx) => ({
      workout_id: workoutId,
      exercise_id: e.exerciseId,
      order_index: idx,
      // If your workout_exercises table doesn't have "note", remove this line.
      note: e.note ?? null,
    }));

    const { error: weErr } = await supabase.from("workout_exercises").insert(rows);
    if (weErr) throw weErr;
  }

  return { workoutId };
}

/**
 * If you ever need an "edit workout" later:
 * - update workouts row
 * - delete + reinsert workout_exercises for simplicity
 */
export async function updateWorkoutFromDraft(
  userId: string | null | undefined,
  workoutId: string,
  draft: WorkoutDraft
) {
  assertUser(userId);

  const title = String(draft.title ?? "").trim();
  if (!title) throw new Error("Workout name is required");

  const { error: upErr } = await supabase
    .from("workouts")
    .update({
      title,
      notes: draft.note ?? null,
      is_favourite: !!draft.isFavourite,
    })
    .eq("id", workoutId)
    .eq("user_id", userId);

  if (upErr) throw upErr;

  // reset exercises
  const { error: delErr } = await supabase
    .from("workout_exercises")
    .delete()
    .eq("workout_id", workoutId);

  if (delErr) throw delErr;

  if (draft.exercises.length) {
    const rows = draft.exercises.map((e, idx) => ({
      workout_id: workoutId,
      exercise_id: e.exerciseId,
      order_index: idx,
      note: e.note ?? null,
    }));

    const { error: insErr } = await supabase.from("workout_exercises").insert(rows);
    if (insErr) throw insErr;
  }
}

/**
 * Convenience for "Save & Start" flow.
 * You’ll call createWorkoutFromDraft, then navigate to your workout overview/live start.
 */
export async function createWorkoutAndReturnId(
  userId: string | null | undefined,
  draft: WorkoutDraft
) {
  const res = await createWorkoutFromDraft(userId, draft);
  return res.workoutId;
}
