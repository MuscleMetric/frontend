import { supabase } from "../../../../../lib/supabase";

function assertUser(userId: string | null | undefined) {
  if (!userId) throw new Error("Missing user session");
}

/**
 * Workout favourite:
 * Assumes workouts has is_favourite boolean.
 */
export async function setWorkoutFavourite(
  userId: string | null | undefined,
  workoutId: string,
  isFavourite: boolean
) {
  assertUser(userId);

  const { error } = await supabase
    .from("workouts")
    .update({ is_favourite: !!isFavourite })
    .eq("id", workoutId)
    .eq("user_id", userId);

  if (error) throw error;
}

/**
 * Exercise favourites (optional):
 * Assumes join table "exercise_favourites" (user_id, exercise_id).
 * If your schema uses a different table/columns, change them here only.
 */
export async function setExerciseFavourite(
  userId: string | null | undefined,
  exerciseId: string,
  isFavourite: boolean
) {
  assertUser(userId);

  if (isFavourite) {
    const { error } = await supabase.from("exercise_favourites").insert({
      user_id: userId,
      exercise_id: exerciseId,
    });

    // If duplicate insert happens, you can ignore it depending on your unique constraint.
    if (error && !String(error.message).toLowerCase().includes("duplicate")) {
      throw error;
    }
  } else {
    const { error } = await supabase
      .from("exercise_favourites")
      .delete()
      .eq("user_id", userId)
      .eq("exercise_id", exerciseId);

    if (error) throw error;
  }
}
