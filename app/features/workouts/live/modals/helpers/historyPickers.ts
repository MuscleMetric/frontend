// live/modals/helpers/historyPickers.ts
import type { LiveExerciseDraft } from "../../state/types";

export function isCardio(ex: LiveExerciseDraft) {
  return (ex.type ?? "").toLowerCase() === "cardio";
}

export function pickLastSessionSet(ex: LiveExerciseDraft, setNumber: number) {
  const ls = ex.lastSession?.sets ?? [];
  if (!ls.length) return null;

  const same = ls.find((x) => x.setNumber === setNumber && (x.dropIndex ?? 0) === 0);
  if (same) return same;

  const type = (ex.type ?? "").toLowerCase();
  const last = [...ls].reverse().find((x) => {
    if (type === "cardio") return (x.distance ?? 0) > 0 || (x.timeSeconds ?? 0) > 0;
    return (x.reps ?? 0) > 0 || (x.weight ?? 0) > 0;
  });

  return last ?? null;
}
