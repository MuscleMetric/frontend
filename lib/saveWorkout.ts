// lib/saveWorkout.ts
import { supabase } from "./supabase";
import type { ReviewPayload, StrengthSet, CardioSet } from "./sessionStore";

function n(x: any): number | null {
  const v = Number(x);
  return Number.isFinite(v) ? v : null;
}

function hasStrengthData(
  s?: { reps?: any; weight?: any; drops?: any[] },
  dropMode?: boolean
) {
  if (!s) return false;
  if (dropMode) {
    const drops = s.drops ?? [];
    // at least one drop row has reps or weight
    return drops.some(
      (d) => (d?.reps && d.reps !== "0") || (d?.weight && d.weight !== "0")
    );
  }
  return (s.reps && s.reps !== "0") || (s.weight && s.weight !== "0");
}

function hasCardioData(s?: { distance?: any; timeSec?: any }) {
  if (!s) return false;
  return (s.distance && s.distance !== "0") || (s.timeSec && s.timeSec !== "0");
}

type SaveArgs = {
  userId: string;
  payload: ReviewPayload; // from sessionStore
  totalDurationSec: number; // totalSec you passed to review page
  completedAt?: Date; // defaults to now
  planWorkoutIdToComplete?: string; // optional: plan_workouts.id to mark weekly_complete
};

export type SaveResult = { workoutHistoryId: string };

// lib/saveWorkout.ts (only the function body shown for brevity)
export async function saveCompletedWorkout(
  args: SaveArgs
): Promise<SaveResult> {
  const {
    userId,
    payload,
    totalDurationSec,
    completedAt = new Date(),
    planWorkoutIdToComplete,
  } = args;

  const { workout, state } = payload;

  // 1) Parent history
  const { data: whInsert, error: whErr } = await supabase
    .from("workout_history")
    .insert({
      user_id: userId,
      workout_id: workout.id,
      completed_at: completedAt.toISOString(),
      duration_seconds: totalDurationSec,
      notes: state.workoutNotes ?? null,
    })
    .select("id")
    .single();

  if (whErr || !whInsert?.id) {
    throw new Error(
      `Failed to create workout_history: ${whErr?.message || "unknown"}`
    );
  }
  const workoutHistoryId = whInsert.id as string;

  try {
    // 2) Insert workout_exercise_history (snapshot)
    const wexhRows: Array<{
      workout_history_id: string;
      exercise_id: string;
      order_index: number;
      notes: string | null;
      workout_exercise_id: string | null;
      is_dropset: boolean | null;
      superset_group: string | null;
      superset_index: number | null;
    }> = [];

    const weIdToInserted: Record<string, string> = {};

    for (const we of workout.workout_exercises) {
      const exState = state.byWeId[we.id];
      if (!exState) continue;

      const exerciseId = (we as any).exercise_id ?? we.exercises?.id ?? "";
      if (!exerciseId)
        throw new Error(`Missing exercise_id for workout_exercise ${we.id}`);

      wexhRows.push({
        workout_history_id: workoutHistoryId,
        exercise_id: String(exerciseId),
        order_index: we.order_index ?? 0,
        notes: exState.notes ?? null,
        workout_exercise_id: we.id || null,
        is_dropset:
          exState.kind === "strength" ? !!(exState as any).dropMode : null,
        superset_group: we.superset_group ?? null,
        superset_index: we.superset_index ?? null,
      });
    }

    if (wexhRows.length) {
      const { data: wexhInserts, error: wexhErr } = await supabase
        .from("workout_exercise_history")
        .insert(wexhRows)
        .select("id, workout_exercise_id");
      if (wexhErr)
        throw new Error(
          `Failed to create workout_exercise_history: ${wexhErr.message}`
        );

      for (const row of wexhInserts || []) {
        const key = row.workout_exercise_id as string | null;
        if (key) weIdToInserted[key] = row.id as string;
      }
    }

    // 3) Insert workout_set_history
    const setRows: Array<{
      workout_exercise_history_id: string;
      set_number: number;
      drop_index: number;
      reps: number | null;
      weight: number | null;
      time_seconds: number | null;
      distance: number | null;
      notes: string | null;
    }> = [];

    for (const we of workout.workout_exercises) {
      const exState = state.byWeId[we.id];
      if (!exState) continue;

      let wexhId = weIdToInserted[we.id] || null;
      if (!wexhId) {
        const { data: found, error: findErr } = await supabase
          .from("workout_exercise_history")
          .select("id")
          .eq("workout_history_id", workoutHistoryId)
          .eq("exercise_id", (we as any).exercise_id ?? we.exercises?.id ?? "")
          .eq("order_index", we.order_index ?? 0)
          .maybeSingle();
        if (findErr || !found?.id) {
          throw new Error(
            `Could not resolve workout_exercise_history for we:${we.id} — ${
              findErr?.message || "not found"
            }`
          );
        }
        wexhId = found.id as string;
        weIdToInserted[we.id] = wexhId;
      }

      if (exState.kind === "strength") {
        const dropMode = !!(exState as any).dropMode;
        (exState.sets as StrengthSet[]).forEach((s, i) => {
          if (!hasStrengthData(s, dropMode)) return;
          if (dropMode) {
            const drops = (s.drops ?? []).length
              ? s.drops!
              : [{ reps: s.reps, weight: s.weight }];
            drops.forEach((d, di) => {
              if (
                !((d.reps && d.reps !== "0") || (d.weight && d.weight !== "0"))
              )
                return;
              setRows.push({
                workout_exercise_history_id: wexhId!,
                set_number: i + 1,
                drop_index: di,
                reps: n(d.reps),
                weight: n(d.weight),
                time_seconds: null,
                distance: null,
                notes: null,
              });
            });
          } else {
            setRows.push({
              workout_exercise_history_id: wexhId!,
              set_number: i + 1,
              drop_index: 0,
              reps: n(s.reps),
              weight: n(s.weight),
              time_seconds: null,
              distance: null,
              notes: null,
            });
          }
        });
      } else {
        (exState.sets as CardioSet[]).forEach((s, i) => {
          if (!hasCardioData(s)) return;
          setRows.push({
            workout_exercise_history_id: wexhId!,
            set_number: i + 1,
            drop_index: 0,
            reps: null,
            weight: null,
            time_seconds: n(s.timeSec),
            distance: n(s.distance),
            notes: null,
          });
        });
      }
    }

    if (setRows.length) {
      const { error: setErr } = await supabase
        .from("workout_set_history")
        .insert(setRows);
      if (setErr)
        throw new Error(
          `Failed to create workout_set_history: ${setErr.message}`
        );
    }

    // 4) Mark plan_workouts weekly_complete (now throws if blocked)
    if (planWorkoutIdToComplete) {
      const { error: pwErr } = await supabase
        .from("plan_workouts")
        .update({ weekly_complete: true })
        .eq("id", planWorkoutIdToComplete);
      if (pwErr) {
        console.log(pwErr);
        throw new Error(
          `Failed to update plan_workouts.weekly_complete: ${pwErr.message}`
        );
      }
    }

    // 5) Update workout_exercises targets for next time (based on what user just did)
    //    (per-row updates since each row has different values)
    for (const we of workout.workout_exercises) {
      const exState = state.byWeId[we.id];
      if (!exState) continue;

      const patch: any = {};
      if (exState.kind === "strength") {
        const drop = !!(exState as any).dropMode;

        // filter to sets with data
        const filled = (exState.sets as StrengthSet[]).filter((s) =>
          hasStrengthData(s, drop)
        );
        if (!filled.length) continue;

        // sets count
        patch.target_sets = filled.length;

        // last non-empty set reps
        for (let i = filled.length - 1; i >= 0; i--) {
          const st = filled[i];
          const lastReps = drop
            ? (st.drops ?? []).at(-1)?.reps ?? st.reps
            : st.reps;
          if (Number(lastReps)) {
            patch.target_reps = Number(lastReps);
            break;
          }
        }

        // max weight across all sets (and all drops)
        let maxW = 0;
        for (const st of filled) {
          if (drop) {
            for (const d of st.drops ?? []) {
              const w = Number(d?.weight || 0);
              if (w > maxW) maxW = w;
            }
          } else {
            const w = Number(st.weight || 0);
            if (w > maxW) maxW = w;
          }
        }
        patch.target_weight = maxW;
      } else {
        // cardio: use last non-empty distance/time
        const filled = (exState.sets as CardioSet[]).filter((s) =>
          hasCardioData(s)
        );
        if (!filled.length) continue;

        for (let i = filled.length - 1; i >= 0; i--) {
          const st = filled[i];
          if (Number(st.distance)) {
            patch.target_distance = Number(st.distance);
            break;
          }
        }
        for (let i = filled.length - 1; i >= 0; i--) {
          const st = filled[i];
          if (Number(st.timeSec)) {
            patch.target_time_seconds = Number(st.timeSec);
            break;
          }
        }
      }

      if (Object.keys(patch).length) {
        await supabase.from("workout_exercises").update(patch).eq("id", we.id);
      }
    }

    return { workoutHistoryId };
  } catch (e) {
    await supabase.from("workout_history").delete().eq("id", workoutHistoryId);
    throw e;
  }
}
