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
  clientSaveId: string; // REQUIRED for idempotency
  payload: ReviewPayload;
  totalDurationSec: number;
  completedAt?: Date;
  planWorkoutIdToComplete?: string;
};

export type SaveResult = { workoutHistoryId: string };

type RpcWorkout = {
  client_save_id: string; // NEW
  workout_id: string;
  completed_at: string;
  duration_seconds: number;
  notes: string;
  plan_workout_id?: string;
  exercise_history: Array<{
    exercise_id: string;
    order_index: number;
    notes: string;
    workout_exercise_id: string; // "" for ad-hoc
    is_dropset: boolean;
    superset_group: string;
    superset_index: string; // "" if null
    sets: Array<{
      set_number: number;
      drop_index: number;
      reps: number | null;
      weight: number | null;
      time_seconds: number | null;
      distance: number | null;
      notes: string | null;
    }>;
  }>;
  workout_exercise_updates: Array<{
    id: string;
    target_sets?: number;
    target_reps?: number;
    target_weight?: number;
    target_time_seconds?: number;
    target_distance?: number;
  }>;
};

function buildRpcPayload(args: SaveArgs): RpcWorkout {
  const {
    payload,
    totalDurationSec,
    completedAt = new Date(),
    planWorkoutIdToComplete,
  } = args;

  const { workout, state } = payload;

  const exercise_history: RpcWorkout["exercise_history"] = [];
  const workout_exercise_updates: RpcWorkout["workout_exercise_updates"] = [];

  for (const we of workout.workout_exercises) {
    const exState = state.byWeId[we.id];
    if (!exState) continue;

    const isAdHoc = (we as any).isAdHoc === true;

    const exerciseId = (we as any).exercise_id ?? we.exercises?.id ?? "";
    if (!exerciseId)
      throw new Error(`Missing exercise_id for workout_exercise ${we.id}`);

    const dropMode =
      exState.kind === "strength" ? !!(exState as any).dropMode : false;

    const sets: RpcWorkout["exercise_history"][number]["sets"] = [];

    if (exState.kind === "strength") {
      (exState.sets as StrengthSet[]).forEach((s, i) => {
        if (!hasStrengthData(s, dropMode)) return;

        if (dropMode) {
          const drops = (s.drops ?? []).length
            ? s.drops!
            : [{ reps: s.reps, weight: s.weight }];
          drops.forEach((d, di) => {
            if (!((d.reps && d.reps !== "0") || (d.weight && d.weight !== "0")))
              return;
            sets.push({
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
          sets.push({
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
        sets.push({
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

    // If user never entered any data for this exercise, skip it entirely (like you do today)
    if (!sets.length) continue;

    exercise_history.push({
      exercise_id: String(exerciseId),
      order_index: we.order_index ?? 0,
      notes: exState.notes ?? "",
      workout_exercise_id: isAdHoc ? "" : we.id ?? "",
      is_dropset: exState.kind === "strength" ? dropMode : false,
      superset_group: we.superset_group ?? "",
      superset_index:
        we.superset_index != null ? String(we.superset_index) : "",
      sets,
    });

    // Build your target updates for next time (skip ad-hoc)
    if (!isAdHoc) {
      const patch: any = { id: we.id };

      if (exState.kind === "strength") {
        const filled = (exState.sets as StrengthSet[]).filter((s) =>
          hasStrengthData(s, dropMode)
        );
        if (filled.length) {
          patch.target_sets = filled.length;

          for (let i = filled.length - 1; i >= 0; i--) {
            const st = filled[i];
            const lastReps = dropMode
              ? (st.drops ?? []).at(-1)?.reps ?? st.reps
              : st.reps;
            if (Number(lastReps)) {
              patch.target_reps = Number(lastReps);
              break;
            }
          }

          let maxW = 0;
          for (const st of filled) {
            if (dropMode) {
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
        }
      } else {
        const filled = (exState.sets as CardioSet[]).filter((s) =>
          hasCardioData(s)
        );
        if (filled.length) {
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
      }

      if (Object.keys(patch).length > 1) workout_exercise_updates.push(patch);
    }
  }

  return {
    client_save_id: args.clientSaveId,
    workout_id: workout.id,
    completed_at: completedAt.toISOString(),
    duration_seconds: totalDurationSec,
    notes: state.workoutNotes ?? "",
    plan_workout_id: planWorkoutIdToComplete ?? "",
    exercise_history,
    workout_exercise_updates,
  };
}

export async function saveCompletedWorkout(
  args: SaveArgs
): Promise<SaveResult> {
  const payload = buildRpcPayload(args);

  const { data, error } = await supabase.rpc("save_completed_workout_v1", {
    p_workout: payload,
  });

  if (error) {
    throw new Error(error.message);
  }

  return { workoutHistoryId: String(data) };
}
