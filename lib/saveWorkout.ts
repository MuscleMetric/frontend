// lib/saveWorkout.ts
import { supabase } from "./supabase";
import type { LiveWorkoutDraft } from "@/app/features/workouts/live/state/types";
import * as Sentry from "@sentry/react-native";
import type { ReviewPayload } from "./sessionStore";
import { log } from "@/lib/logger";
import {
  getExerciseLoggingProfile,
  hasCompletedSet,
} from "@/app/features/workouts/logging/exerciseLoggingProfile";

const DEBUG_SAVE = __DEV__;

function dlog(message: string, data?: Record<string, any>) {
  if (!DEBUG_SAVE) return;
  log(`[saveWorkout] ${message}`, data ?? {});
}

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

export function durationSecondsFromDraft(
  d: LiveWorkoutDraft,
  atIso = nowIso(),
) {
  const base = Number((d as any).timerElapsedSeconds ?? 0);
  const last = (d as any).timerLastActiveAt as string | null | undefined;
  if (!last) return Math.max(0, base);
  return Math.max(0, base + secondsBetween(last, atIso));
}

function toNumOrNull(x: any): number | null {
  if (x === "" || x === undefined || x === null) return null;
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

type RpcWorkout = {
  client_save_id: string;
  workout_id: string | null;
  completed_at: string;
  duration_seconds: number;
  notes: string;
  plan_workout_id?: string;

  exercise_history: Array<{
    exercise_id: string;
    order_index: number;
    notes: string;
    workout_exercise_id: string;
    is_dropset: boolean;
    superset_group: string;
    superset_index: string;
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
    0,
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
  clientSaveId: string;
  draft: LiveWorkoutDraft;
  workoutId?: string | null;
  planWorkoutIdToComplete?: string;
  completedAt?: Date;
  durationSeconds?: number;
  notes?: string;
};

export type SaveResult = { workoutHistoryId: string };

export function buildRpcPayloadFromDraft(args: SaveFromDraftArgs): RpcWorkout {
  const {
    draft,
    clientSaveId,
    completedAt = new Date(),
    planWorkoutIdToComplete,
  } = args;

  const workoutId =
    args.workoutId ??
    ((draft as any).workoutId as string | null | undefined) ??
    ((draft as any).workout_id as string | null | undefined) ??
    null;

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

  const exercises = (draft.exercises ?? [])
    .slice()
    .sort((a: any, b: any) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));

  const exercise_history: RpcWorkout["exercise_history"] = [];

  for (const ex of exercises as any[]) {
    const exerciseId = String(ex.exerciseId ?? ex.exercise_id ?? "");
    if (!exerciseId) continue;

    const profile = getExerciseLoggingProfile(ex);

    const p = ex.prescription ?? {};
    const supersetGroup = String(p.supersetGroup ?? "");
    const supersetIndex =
      p.supersetIndex !== null &&
      p.supersetIndex !== undefined &&
      String(p.supersetIndex) !== ""
        ? String(p.supersetIndex)
        : "";

    const isDropset =
      Boolean(profile.canShowDropset) && Boolean(p.isDropset);

    const exNotes = (p.notes ?? ex.notes ?? "") as string;
    const sets: RpcWorkout["exercise_history"][number]["sets"] = [];

    for (const s of (ex.sets ?? []) as any[]) {
      const setNumber = Number(s.setNumber ?? s.set_number ?? 0);
      const dropIndex = Number(s.dropIndex ?? s.drop_index ?? 0);

      if (!Number.isFinite(setNumber) || setNumber <= 0) continue;

      const reps = profile.supportsReps ? repsNumOrNull(s.reps) : null;
      const weight = profile.supportsWeight ? toNumOrNull(s.weight) : null;
      const timeSeconds = profile.supportsTime
        ? toNumOrNull(s.timeSeconds)
        : null;
      const distance = profile.supportsDistance
        ? toNumOrNull(s.distance)
        : null;

      if (
        !hasCompletedSet(profile, {
          reps,
          weight,
          timeSeconds,
          distance,
        })
      ) {
        continue;
      }

      sets.push({
        set_number: setNumber,
        drop_index: Number.isFinite(dropIndex) ? dropIndex : 0,
        reps,
        weight,
        time_seconds: timeSeconds,
        distance,
        notes: s.notes ?? null,
      });
    }

    if (!sets.length) continue;

    const workoutExerciseId = ex.workoutExerciseId
      ? String(ex.workoutExerciseId)
      : "";

    exercise_history.push({
      exercise_id: exerciseId,
      order_index: Number(ex.orderIndex ?? 0) || 0,
      notes: exNotes ?? "",
      workout_exercise_id: workoutExerciseId,
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
    workout_exercise_updates: [],
  };
}

export async function saveCompletedWorkoutFromLiveDraft(
  args: SaveFromDraftArgs,
): Promise<SaveResult> {
  const payload = buildRpcPayloadFromDraft(args);
  const summary = summarizeRpcPayload(payload);

  dlog("payload summary", summary);

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
    dlog("rpc success", { workoutHistoryId: String(data) });

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

export type SaveFromReviewArgs = {
  clientSaveId: string;
  payload: ReviewPayload;
  completedAt?: Date;
  totalDurationSec: number;
  planWorkoutIdToComplete?: string;
};

export function buildRpcPayloadFromReview(
  args: SaveFromReviewArgs,
): RpcWorkout {
  const {
    clientSaveId,
    payload,
    completedAt = new Date(),
    totalDurationSec,
    planWorkoutIdToComplete,
  } = args;

  const workout = payload.workout;
  const state = payload.state;

  const exercise_history: RpcWorkout["exercise_history"] = [];

  const sortedExercises = [...(workout.workout_exercises ?? [])].sort(
    (a, b) => (a.order_index ?? 0) - (b.order_index ?? 0),
  );

  for (const we of sortedExercises) {
    const exState = state.byWeId[we.id];
    if (!exState) continue;

    const exerciseId = String(we.exercise_id ?? "");
    if (!exerciseId) continue;

    const sets: RpcWorkout["exercise_history"][number]["sets"] = [];

    if (exState.kind === "strength") {
      let logicalSetNumber = 0;

      for (const set of exState.sets ?? []) {
        const reps =
          set.reps === "" || set.reps == null ? null : Number(set.reps);
        const weight =
          set.weight === "" || set.weight == null ? 0 : Number(set.weight);

        if (reps == null || !Number.isFinite(reps)) continue;

        logicalSetNumber += 1;

        sets.push({
          set_number: logicalSetNumber,
          drop_index: 0,
          reps,
          weight: Number.isFinite(weight) ? weight : 0,
          time_seconds: null,
          distance: null,
          notes: null,
        });

        for (let i = 0; i < (set.drops ?? []).length; i++) {
          const drop = set.drops?.[i];
          const dropReps =
            drop?.reps === "" || drop?.reps == null ? null : Number(drop.reps);
          const dropWeight =
            drop?.weight === "" || drop?.weight == null
              ? 0
              : Number(drop.weight);

          if (dropReps == null || !Number.isFinite(dropReps)) continue;

          sets.push({
            set_number: logicalSetNumber,
            drop_index: i + 1,
            reps: dropReps,
            weight: Number.isFinite(dropWeight) ? dropWeight : 0,
            time_seconds: null,
            distance: null,
            notes: null,
          });
        }
      }
    } else {
      let logicalSetNumber = 0;

      for (const set of exState.sets ?? []) {
        const time_seconds =
          set.timeSec === "" || set.timeSec == null
            ? null
            : Number(set.timeSec);

        const distance =
          set.distance === "" || set.distance == null
            ? null
            : Number(set.distance);

        const hasTime = time_seconds != null && Number.isFinite(time_seconds);
        const hasDistance = distance != null && Number.isFinite(distance);

        if (!hasTime && !hasDistance) continue;

        logicalSetNumber += 1;

        sets.push({
          set_number: logicalSetNumber,
          drop_index: 0,
          reps: null,
          weight: null,
          time_seconds: hasTime ? time_seconds : null,
          distance: hasDistance ? distance : null,
          notes: null,
        });
      }
    }

    if (!sets.length) continue;

    const supersetGroup = we.superset_group ?? "";
    const supersetIndex =
      we.superset_index == null ? "" : String(we.superset_index);

    exercise_history.push({
      exercise_id: exerciseId,
      order_index: we.order_index ?? 0,
      notes: exState.notes ?? we.notes ?? "",
      workout_exercise_id: we.id ?? "",
      is_dropset: Boolean(we.is_dropset),
      superset_group: supersetGroup,
      superset_index: supersetIndex,
      sets,
    });
  }

  return {
    client_save_id: clientSaveId,
    workout_id: workout.id ?? null,
    completed_at: completedAt.toISOString(),
    duration_seconds: Math.max(0, Math.floor(totalDurationSec)),
    notes: state.workoutNotes ?? "",
    plan_workout_id: planWorkoutIdToComplete ?? "",
    exercise_history,
    workout_exercise_updates: [],
  };
}

export async function saveCompletedWorkoutFromReviewPayload(
  args: SaveFromReviewArgs,
): Promise<SaveResult> {
  const payload = buildRpcPayloadFromReview(args);
  const summary = summarizeRpcPayload(payload);

  dlog("review payload summary", summary);
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