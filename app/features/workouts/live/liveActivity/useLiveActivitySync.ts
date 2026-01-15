import { useEffect, useMemo, useRef } from "react";
import type { LiveWorkoutDraft } from "../state/types";
import { getActiveExercise, getExerciseCtaLabel } from "../state/selectors";
import { startLiveWorkout, updateLiveWorkout, stopLiveWorkout } from "@/lib/liveWorkout";

function isoToMs(iso: string) {
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : Date.now();
}

export function useLiveActivitySync(draft: LiveWorkoutDraft | null, enabled: boolean) {
  const startedAtMs = useMemo(() => (draft ? isoToMs(draft.startedAt) : 0), [draft?.startedAt]);
  const lastKeyRef = useRef<string>("");

  // Start/stop lifecycle
  useEffect(() => {
    if (!enabled || !draft) return;

    const { exercise } = getActiveExercise(draft);
    const setLabel = `Set ${draft.ui.activeSetNumber} of ${exercise?.sets.length ?? 1}`;

    startLiveWorkout({
      startedAt: startedAtMs,
      workoutTitle: draft.title ?? "Workout",
      currentExercise: exercise?.name ?? "Exercise",
      setLabel,
      prevLabel: undefined,
    });

    return () => {
      stopLiveWorkout();
    };
  }, [enabled, draft?.draftId]);

  // Updates (throttled by key changes)
  useEffect(() => {
    if (!enabled || !draft) return;

    const { exercise } = getActiveExercise(draft);
    if (!exercise) return;

    const idx = Math.max(1, draft.ui.activeSetNumber);
    const cur = exercise.sets.find((s) => s.setNumber === idx);
    const prev = exercise.sets.find((s) => s.setNumber === idx - 1);

    const type = (exercise.type ?? "").toLowerCase();
    const setLabel = `Set ${idx} of ${exercise.sets.length}`;

    let prevLabel: string | undefined;
    if (prev) {
      if (type === "cardio") {
        const d = prev.distance ?? 0;
        const t = prev.timeSeconds ?? 0;
        if (d || t) prevLabel = `${d} km • ${t}s`;
      } else {
        const r = prev.reps ?? 0;
        const w = prev.weight ?? 0;
        if (r || w) prevLabel = `${r}×${w}kg`;
      }
    }

    // also include CTA status in key so activity updates when moving from Start->Continue->Edit
    const cta = getExerciseCtaLabel(exercise);

    const payload = {
      startedAt: startedAtMs,
      workoutTitle: draft.title ?? "Workout",
      currentExercise: exercise.name ?? "Exercise",
      setLabel,
      prevLabel,
      _cta: cta,
      _u: draft.updatedAt,
      _cur: cur ? `${cur.reps}-${cur.weight}-${cur.distance}-${cur.timeSeconds}` : "",
    };

    const key = JSON.stringify(payload);
    if (key === lastKeyRef.current) return;

    lastKeyRef.current = key;

    updateLiveWorkout({
      startedAt: startedAtMs,
      workoutTitle: draft.title ?? "Workout",
      currentExercise: exercise.name ?? "Exercise",
      setLabel,
      prevLabel,
    });
  }, [enabled, draft?.updatedAt, draft?.ui.activeExerciseIndex, draft?.ui.activeSetNumber]);
}
