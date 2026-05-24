// app/features/workouts/data/coachTips.ts

export const WORKOUT_NOTES: string[] = [
  "This card shows a simple workout reminder based on logged activity.",
  "Each logged workout adds to your training history.",
  "Progress summaries are based on the workouts you record.",
  "Logged sessions help build your workout trends over time.",
  "Your workout history updates as you complete sessions.",
  "Use your logged sets, reps, weight, time, and distance to review progress.",
  "Workout summaries are based only on the data you enter.",
  "Your recent activity will appear in progress summaries after logging.",
  "One logged workout at a time builds your activity history.",
  "Plan and progress views update from completed workouts.",
  "Your workout records help show changes over time.",
  "Log this session when complete to update your history.",
];

function dayKeyLocal(now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function hashString(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function getWorkoutNoteForToday(opts?: {
  userId?: string | null;
  now?: Date;
}) {
  const now = opts?.now ?? new Date();
  const key = `${dayKeyLocal(now)}:${opts?.userId ?? "anon"}`;
  const idx = hashString(key) % WORKOUT_NOTES.length;
  return WORKOUT_NOTES[idx];
}