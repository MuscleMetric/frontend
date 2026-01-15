import * as React from "react";
import {
  startLiveWorkout,
  updateLiveWorkout,
  stopLiveWorkout,
} from "@/lib/liveWorkout";

type LastSetSnapshot = {
  reps: number | null;
  weight: number | null;
  distance: number | null;
  timeSec: number | null;
};

type LivePayload = {
  currentExercise?: string;
  setLabel?: string;
  prevLabel?: string;
};

type SupersetInfo = {
  byGroup: Record<string, string[]>;
  byWeId: Record<string, { group: string; pos: number }>;
  labels: Record<string, string>;
};

type StrengthDrop = { reps?: string; weight?: string };
type StrengthSet = { reps?: string; weight?: string; drops?: StrengthDrop[] };
type CardioSet = { distance?: string; timeSec?: string };

type ExerciseState =
  | {
      kind: "strength";
      sets: StrengthSet[];
      currentSet: number;
      dropMode?: boolean;
      completed: boolean;
      notes?: string;
      open: boolean;
    }
  | {
      kind: "cardio";
      sets: CardioSet[];
      currentSet: number;
      completed: boolean;
      notes?: string;
      open: boolean;
    };

type WorkoutExercise = {
  id: string; // workout_exercises.id (template id) OR adhoc id
  exercise_id: string; // exercises.id
  exercises: { name: string | null; type: string | null } | null;
};

type Workout = {
  id: string;
  title: string | null;
  workout_exercises: WorkoutExercise[];
};

type InProgressState = {
  byWeId: Record<string, ExerciseState>;
  startedAt: number;
  supersetRoundByGroup?: Record<string, number>;
};

function isStrengthState(ex: ExerciseState): ex is Extract<ExerciseState, { kind: "strength" }> {
  return ex.kind === "strength";
}
function isCardioState(ex: ExerciseState): ex is Extract<ExerciseState, { kind: "cardio" }> {
  return ex.kind === "cardio";
}

/**
 * ✅ Carries over your existing Live Activities behavior:
 * - startLiveWorkout once (workout+startedAt)
 * - updateLiveWorkout every second, only if payload changed
 * - stopLiveWorkout on unmount
 * No UI concerns here.
 */
export function useLiveActivitySync({
  workout,
  state,
  supersets,
  isPlanWorkout,
  lastSetsByWeId,
  lastSetsByExerciseId,
}: {
  workout: Workout | null;
  state: InProgressState | null;
  supersets: SupersetInfo;
  isPlanWorkout: boolean;
  lastSetsByWeId: Record<string, LastSetSnapshot[]>;
  lastSetsByExerciseId: Record<string, LastSetSnapshot[]>;
}) {
  const workoutRef = React.useRef<Workout | null>(null);
  const stateRef = React.useRef<InProgressState | null>(null);
  const supersetsRef = React.useRef<SupersetInfo>(supersets);

  React.useEffect(() => {
    workoutRef.current = workout;
  }, [workout]);

  React.useEffect(() => {
    stateRef.current = state;
  }, [state]);

  React.useEffect(() => {
    supersetsRef.current = supersets;
  }, [supersets]);

  const deriveLivePayloadFrom = React.useCallback(
    (
      w: Workout,
      s: InProgressState,
      ss: SupersetInfo,
      planFlag: boolean,
      lastByWe: Record<string, LastSetSnapshot[]>,
      lastByEx: Record<string, LastSetSnapshot[]>
    ): LivePayload => {
      const openWe =
        w.workout_exercises.find((we) => s.byWeId[we.id]?.open) ??
        w.workout_exercises.find((we) => !s.byWeId[we.id]?.completed);

      if (!openWe) return {};

      const exState = s.byWeId[openWe.id];
      if (!exState) return {};

      const node = ss.byWeId[openWe.id];
      const currentIdx = node
        ? s.supersetRoundByGroup?.[node.group] ?? 0
        : exState.currentSet;

      let setLabel: string | undefined;
      let prevLabel: string | undefined;

      const histArr = planFlag
        ? lastByWe[openWe.id]
        : lastByEx[openWe.exercise_id];

      if (exState.kind === "strength") {
        setLabel = `Set ${currentIdx + 1} of ${exState.sets.length}`;

        // previous label for first set: show last time
        if (currentIdx === 0 && histArr && histArr.length > 0) {
          const histIdx = Math.min(currentIdx, histArr.length - 1);
          const snap =
            histArr?.[histIdx] ??
            histArr?.find((x) => !!x) ??
            [...(histArr ?? [])].reverse().find((x) => !!x);

          if (snap) {
            const reps = snap.reps ?? 0;
            const weight = snap.weight ?? 0;
            prevLabel = `${reps}×${weight}kg`;
          }
        }

        // after set 1+: show what user just did
        if (currentIdx > 0) {
          const last = exState.sets[currentIdx - 1] as any;

          if ((exState as any).dropMode) {
            const drops = (last.drops ?? []) as { reps?: string; weight?: string }[];
            if (drops.length) {
              const chain = drops
                .map((d) => `${d.reps || 0}×${d.weight || 0}`)
                .join(" → ");
              prevLabel = `${chain}kg`;
            }
          } else if (last.reps || last.weight) {
            prevLabel = `${last.reps || 0}×${last.weight || 0}kg`;
          }
        }
      } else {
        setLabel = `Set ${currentIdx + 1} of ${exState.sets.length}`;

        if (currentIdx === 0 && histArr && histArr.length > 0) {
          const histIdx = Math.min(currentIdx, histArr.length - 1);
          const snap = histArr[histIdx];
          if (snap) {
            const dist = snap.distance ?? 0;
            const t = snap.timeSec ?? 0;
            prevLabel = `${dist} km • ${t}s`;
          }
        }

        if (currentIdx > 0) {
          const last = exState.sets[currentIdx - 1] as any;
          if (last.distance || last.timeSec) {
            prevLabel = `${last.distance || 0} km • ${last.timeSec || 0}s`;
          }
        }
      }

      return {
        currentExercise: openWe.exercises?.name ?? "Exercise",
        setLabel,
        prevLabel,
      };
    },
    []
  );

  const deriveLivePayload = React.useCallback((): LivePayload => {
    if (!workoutRef.current || !stateRef.current) return {};
    return deriveLivePayloadFrom(
      workoutRef.current,
      stateRef.current,
      supersetsRef.current,
      isPlanWorkout,
      lastSetsByWeId,
      lastSetsByExerciseId
    );
  }, [deriveLivePayloadFrom, isPlanWorkout, lastSetsByWeId, lastSetsByExerciseId]);

  // ✅ start/stop once per workout session
  React.useEffect(() => {
    if (!workout || !state) return;

    const { currentExercise, setLabel, prevLabel } = deriveLivePayloadFrom(
      workout,
      state,
      supersets,
      isPlanWorkout,
      lastSetsByWeId,
      lastSetsByExerciseId
    );

    startLiveWorkout({
      startedAt: state.startedAt,
      workoutTitle: workout.title ?? "Workout",
      currentExercise,
      setLabel,
      prevLabel,
    });

    return () => {
      stopLiveWorkout();
    };
    // IMPORTANT: keep these deps stable and explicit
  }, [
    workout?.id,
    state?.startedAt,
    deriveLivePayloadFrom,
    supersets,
    isPlanWorkout,
    lastSetsByWeId,
    lastSetsByExerciseId,
  ]);

  // ✅ update every second, only on change
  const lastLiveRef = React.useRef<string>("");

  React.useEffect(() => {
    if (!workout?.id || !state?.startedAt) return;

    const tick = setInterval(() => {
      const w = workoutRef.current;
      const s = stateRef.current;
      const ss = supersetsRef.current;
      if (!w || !s) return;

      const payload = deriveLivePayloadFrom(
        w,
        s,
        ss,
        isPlanWorkout,
        lastSetsByWeId,
        lastSetsByExerciseId
      );

      const key = JSON.stringify(payload);
      if (key !== lastLiveRef.current) {
        lastLiveRef.current = key;
        updateLiveWorkout({
          startedAt: s.startedAt,
          workoutTitle: w.title ?? "Workout",
          ...payload,
        });
      }
    }, 1000);

    return () => clearInterval(tick);
  }, [
    workout?.id,
    state?.startedAt,
    deriveLivePayloadFrom,
    isPlanWorkout,
    lastSetsByWeId,
    lastSetsByExerciseId,
  ]);
}
