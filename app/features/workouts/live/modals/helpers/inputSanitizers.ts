// live/modals/helpers/inputSanitizers.ts
export function clampInt(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

/**
 * Allow only digits + one "." + max 2 decimals
 */
export function sanitizeWeightInput(raw: string) {
  let s = raw.replace(/[^\d.]/g, "");

  const firstDot = s.indexOf(".");
  if (firstDot !== -1) {
    const before = s.slice(0, firstDot + 1);
    const after = s.slice(firstDot + 1).replace(/\./g, "");
    s = before + after;
  }

  const dot = s.indexOf(".");
  if (dot !== -1) {
    const a = s.slice(0, dot);
    const b = s.slice(dot + 1).slice(0, 2);
    s = `${a}.${b}`;
  }

  if (s.length >= 2 && s[0] === "0" && s[1] !== ".") {
    s = String(Number(s));
    if (s === "NaN") s = "";
  }

  return s;
}

export function sanitizeRepsInput(raw: string) {
  const s = raw.replace(/[^\d]/g, "");
  if (!s) return "";
  const n = clampInt(Number(s), 0, 300);
  return String(n);
}

/**
 * Cardio time in seconds: digits only, max 6 chars, clamp to 24h
 */
export function sanitizeTimeSecondsInput(raw: string) {
  const s = raw.replace(/[^\d]/g, "");
  if (!s) return "";
  const n = Math.max(0, Math.min(86400, Number(s)));
  return String(n);
}

/**
 * Cardio distance: digits + dot, 2dp
 */
export function sanitizeDistanceInput(raw: string) {
  return sanitizeWeightInput(raw); // same rules are fine for km
}
