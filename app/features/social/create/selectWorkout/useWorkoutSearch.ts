// app/features/social/create/selectWorkout/useWorkoutSearch.ts

import * as React from "react";
import type { WorkoutSelection } from "../state/createPostTypes";

function normalize(s: string) {
  return s.trim().toLowerCase();
}

export function useWorkoutSearch(
  workouts: WorkoutSelection[],
  query: string
): WorkoutSelection[] {
  return React.useMemo(() => {
    const q = normalize(query);
    if (!q) return workouts;

    return workouts.filter((w) => {
      const haystack = [
        w.title,
        w.completedAt,
        w.volumeUnit ?? "",
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [workouts, query]);
}