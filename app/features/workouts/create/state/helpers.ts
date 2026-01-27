// app/features/workouts/create/state/helpers.ts

export function nowIso() {
  return new Date().toISOString();
}

function randKey() {
  return `ex_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

export function makeExerciseKey() {
  return randKey();
}

export function normalizeTitle(input: string) {
  // keep trailing spaces while typing, but collapse internal whitespace
  return input.replace(/\s+/g, " ").trimStart();
}

export function normalizeNote(s: string) {
  return s.trim();
}

// Stable-ish snapshot for dirty check.
// IMPORTANT: This must include all fields you care about (including superset/dropset).
export function snapshotHash(draft: any) {
  // cheap stable stringify (enough for UI dirty checks)
  const json = JSON.stringify(draft, Object.keys(draft).sort());
  let h = 0;
  for (let i = 0; i < json.length; i++) h = (h * 31 + json.charCodeAt(i)) >>> 0;
  return String(h);
}
