// app/features/workouts/data/coachTips.ts

export const COACH_TIPS: string[] = [
  "You’re showing up — that’s the hardest part. Keep it rolling.",
  "Small sessions stack into big results. Stay consistent.",
  "Strong reps today = stronger you tomorrow.",
  "You’re building momentum. Don’t break the chain.",
  "Progress isn’t loud — it’s daily. You’re doing it.",
  "Focus on clean reps. Quality beats ego every time.",
  "You don’t need perfect — you need repeatable.",
  "This is you investing in your future body. Nice work.",
  "One workout at a time. You’re on track.",
  "Discipline looks good on you. Keep going.",
  "Make the next rep your best rep. Then repeat.",
  "You’re closer than you think — stay in the flow.",
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

/**
 * Deterministic daily "random" tip.
 * - Same tip all day (stable across refreshes)
 * - Different day => different tip
 * - Optional userId => different tips per user per day
 */
export function getCoachTipForToday(opts?: {
  userId?: string | null;
  now?: Date;
}) {
  const now = opts?.now ?? new Date();
  const key = `${dayKeyLocal(now)}:${opts?.userId ?? "anon"}`;
  const idx = hashString(key) % COACH_TIPS.length;
  return COACH_TIPS[idx];
}
