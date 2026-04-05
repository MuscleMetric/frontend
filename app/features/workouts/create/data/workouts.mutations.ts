import { supabase } from "../../../../../lib/supabase";
import type { WorkoutDraft } from "../state/types";

type CreateWorkoutResult = {
  workoutId: string;
};

function assertUser(userId: string | null | undefined) {
  if (!userId) throw new Error("Missing user session");
}

function normaliseWorkoutPayload(draft: WorkoutDraft) {
  const title = String(draft.title ?? "").trim();
  if (!title) throw new Error("Workout name is required");

  const notes = draft.note ? String(draft.note).trim() : null;

  return {
    title,
    notes,
    exercises: (draft.exercises ?? []).map((e, idx) => ({
      // create_workout_v1 expects snake_case keys
      exercise_id: e.exerciseId,
      order_index: idx,
      notes: e.note ?? null,

      // keep these aligned with the RPC contract
      is_dropset: !!e.isDropset,
      superset_group: e.supersetGroup ?? null,
      superset_index: e.supersetIndex ?? null,
    })),
  };
}

/**
 * Creates a counted user workout template through the guarded RPC.
 * This must go through create_workout_v1 so billing/template limits are enforced.
 */
export async function createWorkoutFromDraft(
  userId: string | null | undefined,
  draft: WorkoutDraft,
): Promise<CreateWorkoutResult> {
  assertUser(userId);

  const payload = normaliseWorkoutPayload(draft);

  if (!payload.exercises.length) {
    throw new Error("Workout must contain at least one exercise");
  }

  const { data, error } = await supabase.rpc("create_workout_v1", {
    p_workout: payload,
  });

  if (error) {
    // pass through structured error
    throw {
      message: error.message,
      code: (error as any)?.code ?? null,
      details: (error as any)?.details ?? null,
    };
  }

  return { workoutId: String(data) };
}

/**
 * Updates an existing workout template through the hardened RPC.
 */
export async function updateWorkoutFromDraft(
  userId: string | null | undefined,
  workoutId: string,
  draft: WorkoutDraft,
) {
  assertUser(userId);

  const base = normaliseWorkoutPayload(draft);

  if (!base.exercises.length) {
    throw new Error("Workout must contain at least one exercise");
  }

  const isUuid = (s: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      s,
    );

  const payload = {
    workout_id: workoutId,
    title: base.title,
    notes: base.notes,
    exercises: (draft.exercises ?? []).map((e, idx) => ({
      id: e.key && isUuid(e.key) ? e.key : null,
      exercise_id: e.exerciseId,
      order_index: idx,
      notes: e.note ?? null,
      is_dropset: !!e.isDropset,
      superset_group: e.supersetGroup ?? null,
      superset_index: e.supersetIndex ?? null,
    })),
  };

  const { data, error } = await supabase.rpc("update_workout_v1", {
    p_workout: payload,
  });

  if (error) throw error;

  return { workoutId: String(data ?? workoutId) };
}

/**
 * Convenience for "Save & Start" flow.
 */
export async function createWorkoutAndReturnId(
  userId: string | null | undefined,
  draft: WorkoutDraft,
) {
  const res = await createWorkoutFromDraft(userId, draft);
  return res.workoutId;
}
