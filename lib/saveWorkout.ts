// lib/saveWorkout.ts
import { supabase } from "./supabase";
import type { LiveWorkoutDraft } from "@/app/features/workouts/live/state/types";
import * as Sentry from "@sentry/react-native";

function bc(message: string, data?: Record<string, any>) {
  Sentry.addBreadcrumb({
    category: "save_rpc",
    message,
    level: "info",
    data,
  });
}

function nowIso() {
  return new Date().toISOString();
}

function secondsBetween(aIso: string, bIso: string) {
  const a = new Date(aIso).getTime();
  const b = new Date(bIso).getTime();
  return Math.max(0, Math.floor((b - a) / 1000));
}

function repsNumOrNull(x: any): number | null {
  if (x === "" || x === undefined || x === null) return null;
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

function shouldIncludeStrengthSet(s: any) {
  // Your rule, but safe: include only if reps is actually a number
  return repsNumOrNull(s?.reps) !== null;
}

/**
 * Duration derivation from LiveWorkoutDraft timer fields.
 * - timerElapsedSeconds = accumulated “confirmed” seconds
 * - timerLastActiveAt = anchor when running; null = paused
 */
export function durationSecondsFromDraft(
  d: LiveWorkoutDraft,
  atIso = nowIso()
) {
  const base = Number((d as any).timerElapsedSeconds ?? 0);
  const last = (d as any).timerLastActiveAt as string | null | undefined;
  if (!last) return Math.max(0, base);
  return Math.max(0, base + secondsBetween(last, atIso));
}

function toNumOrNull(x: any): number | null {
  if (x === "" || x === undefined) return null;
  if (x === null) return null;
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

function hasStrengthData(set: { reps: any } | null | undefined) {
  // Your rule: include if reps is not null
  if (!set) return false;
  return set.reps !== null && set.reps !== undefined && set.reps !== "";
}

function hasCardioData(
  set: { timeSeconds: any; distance: any } | null | undefined
) {
  // Your rule: include if time OR distance exists
  if (!set) return false;
  const t = set.timeSeconds;
  const d = set.distance;
  const hasT = t !== null && t !== undefined && t !== "";
  const hasD = d !== null && d !== undefined && d !== "";
  return hasT || hasD;
}

// ---- RPC shape (matches your SQL function) ----
type RpcWorkout = {
  client_save_id: string;
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

function summarizeRpcPayload(p: RpcWorkout) {
  const exerciseCount = p.exercise_history.length;
  const setCount = p.exercise_history.reduce(
    (acc, ex) => acc + ex.sets.length,
    0
  );
  let approxBytes = 0;
  try {
    approxBytes = JSON.stringify(p).length;
  } catch {}
  return {
    client_save_id: p.client_save_id,
    workout_id: p.workout_id,
    completed_at: p.completed_at,
    duration_seconds: p.duration_seconds,
    plan_workout_id: p.plan_workout_id,
    exerciseCount,
    setCount,
    updateCount: p.workout_exercise_updates.length,
    approxBytes,
  };
}

export type SaveFromDraftArgs = {
  clientSaveId: string; // REQUIRED for idempotency
  draft: LiveWorkoutDraft;

  // If your draft doesn’t contain these, pass them in here.
  workoutId?: string;
  planWorkoutIdToComplete?: string;

  // Optional overrides
  completedAt?: Date;
  durationSeconds?: number;
  notes?: string;
};

export type SaveResult = { workoutHistoryId: string };

function buildRpcPayloadFromDraft(args: SaveFromDraftArgs): RpcWorkout {
  const {
    draft,
    clientSaveId,
    completedAt = new Date(),
    planWorkoutIdToComplete,
  } = args;

  // Prefer explicit args, fallback to draft fields if they exist
  const workoutId =
    args.workoutId ??
    ((draft as any).workoutId as string | undefined) ??
    ((draft as any).workout_id as string | undefined);

  if (!workoutId) {
    throw new Error(
      "Missing workoutId (pass workoutId or ensure draft.workoutId exists)."
    );
  }

  const planWorkoutId =
    planWorkoutIdToComplete ??
    ((draft as any).planWorkoutId as string | undefined) ??
    ((draft as any).plan_workout_id as string | undefined) ??
    "";

  const durationSeconds =
    typeof args.durationSeconds === "number"
      ? Math.max(0, Math.floor(args.durationSeconds))
      : durationSecondsFromDraft(draft);

  const notes =
    (args.notes ??
      ((draft as any).notes as string | undefined) ??
      ((draft as any).workoutNotes as string | undefined) ??
      "") ||
    "";

  // Sort by orderIndex so save is consistent
  const exercises = (draft.exercises ?? [])
    .slice()
    .sort((a: any, b: any) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));

  const exercise_history: RpcWorkout["exercise_history"] = [];

  for (const ex of exercises as any[]) {
    const exerciseId = String(ex.exerciseId ?? ex.exercise_id ?? "");
    if (!exerciseId) continue;

    const type = String(ex.type ?? "").toLowerCase();
    const isCardio = type === "cardio";

    const p = ex.prescription ?? {};
    const supersetGroup = String(p.supersetGroup ?? "");
    const supersetIndex =
      p.supersetIndex !== null &&
      p.supersetIndex !== undefined &&
      String(p.supersetIndex) !== ""
        ? String(p.supersetIndex)
        : "";

    const isDropset = Boolean(p.isDropset);

    const exNotes = (p.notes ?? ex.notes ?? "") as string;

    const sets: RpcWorkout["exercise_history"][number]["sets"] = [];

    for (const s of (ex.sets ?? []) as any[]) {
      const setNumber = Number(s.setNumber ?? s.set_number ?? 0);
      const dropIndex = Number(s.dropIndex ?? s.drop_index ?? 0);

      if (!Number.isFinite(setNumber) || setNumber <= 0) continue;

      if (!isCardio) {
        if (!shouldIncludeStrengthSet(s)) continue;

        const reps = repsNumOrNull(s.reps);
        const weightRaw = toNumOrNull(s.weight);
        const weight = weightRaw === null ? 0 : weightRaw;

        sets.push({
          set_number: setNumber,
          drop_index: Number.isFinite(dropIndex) ? dropIndex : 0,
          reps,
          weight,
          time_seconds: null,
          distance: null,
          notes: s.notes ?? null,
        });
      } else {
        if (!hasCardioData(s)) continue;

        sets.push({
          set_number: setNumber,
          drop_index: Number.isFinite(dropIndex) ? dropIndex : 0,
          reps: null,
          weight: null,
          time_seconds: toNumOrNull(s.timeSeconds),
          distance: toNumOrNull(s.distance),
          notes: s.notes ?? null,
        });
      }
    }

    // Match your old behavior: if no filled sets, skip exercise entirely
    if (!sets.length) continue;

    const workoutExerciseId = ex.workoutExerciseId
      ? String(ex.workoutExerciseId)
      : "";

    exercise_history.push({
      exercise_id: exerciseId,
      order_index: Number(ex.orderIndex ?? 0) || 0,
      notes: exNotes ?? "",
      workout_exercise_id: workoutExerciseId, // "" means ad-hoc
      is_dropset: isDropset,
      superset_group: supersetGroup,
      superset_index: supersetIndex,
      sets,
    });
  }

  return {
    client_save_id: clientSaveId,
    workout_id: workoutId,
    completed_at: completedAt.toISOString(),
    duration_seconds: durationSeconds,
    notes,
    plan_workout_id: planWorkoutId,
    exercise_history,
    workout_exercise_updates: [], // keep empty for now; we’ll add later if you want target updates
  };
}

export async function saveCompletedWorkoutFromLiveDraft(
  args: SaveFromDraftArgs
): Promise<SaveResult> {
  const payload = buildRpcPayloadFromDraft(args);
  const summary = summarizeRpcPayload(payload);

  bc("rpc start", summary);

  try {
    const { data, error } = await supabase.rpc("save_completed_workout_v1", {
      p_workout: payload,
    });

    if (error) {
      bc("rpc error", {
        ...summary,
        code: (error as any).code,
        details: (error as any).details,
        hint: (error as any).hint,
        message: error.message,
      });

      Sentry.captureException(error, {
        tags: { area: "save_rpc", fn: "save_completed_workout_v1" },
        extra: {
          ...summary,
          code: (error as any).code,
          details: (error as any).details,
          hint: (error as any).hint,
          message: error.message,
        },
      });

      throw new Error(error.message);
    }

    bc("rpc success", { ...summary, workoutHistoryId: String(data) });
    return { workoutHistoryId: String(data) };
  } catch (e: any) {
    bc("rpc exception", { ...summary, message: String(e?.message ?? e) });

    if (!(e && (e as any).name === "PostgrestError")) {
      Sentry.captureException(e, {
        tags: { area: "save_rpc", stage: "unexpected" },
        extra: summary,
      });
    }

    throw e;
  }
}
