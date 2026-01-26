export function trimOrEmpty(s: string) {
  return (s ?? "").trim();
}

export function trimOrNull(s: string) {
  const t = trimOrEmpty(s);
  return t.length ? t : null;
}

export function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}
