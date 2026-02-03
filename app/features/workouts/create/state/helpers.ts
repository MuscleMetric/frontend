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

/**
 * Stable stringify that:
 * - sorts object keys recursively
 * - preserves array order
 * - avoids crashing on undefined
 */
function stableStringify(value: any): string {
  const seen = new WeakSet();

  const walk = (v: any): any => {
    if (v === undefined) return null;
    if (v === null) return null;
    if (typeof v !== "object") return v;

    if (seen.has(v)) return "[Circular]";
    seen.add(v);

    if (Array.isArray(v)) return v.map(walk);

    const out: any = {};
    for (const k of Object.keys(v).sort()) out[k] = walk(v[k]);
    return out;
  };

  return JSON.stringify(walk(value));
}

// Stable-ish snapshot for dirty check.
// IMPORTANT: includes nested exercises + superset/dropset fields.
export function snapshotHash(draft: any) {
  const json = stableStringify(draft);
  let h = 0;
  for (let i = 0; i < json.length; i++) h = (h * 31 + json.charCodeAt(i)) >>> 0;
  return String(h);
}

/** Superset groups we allow. You can extend later. */
export const SUPERSET_GROUPS = ["A", "B", "C", "D", "E", "F"] as const;

export function getExistingSupersetGroups(exercises: Array<{ supersetGroup: string | null }>) {
  const set = new Set<string>();
  for (const ex of exercises) if (ex.supersetGroup) set.add(ex.supersetGroup);
  return Array.from(set).sort();
}

export function getNextSupersetGroup(exercises: Array<{ supersetGroup: string | null }>) {
  const existing = new Set(getExistingSupersetGroups(exercises));
  for (const g of SUPERSET_GROUPS) if (!existing.has(g)) return g;
  // If you run out, just reuse last (or extend list)
  return "A";
}
