export function normalizeSearch(s: string) {
  return (s ?? "").trim().toLowerCase();
}

export function includesSearch(haystack: string, query: string) {
  if (!query) return true;
  return normalizeSearch(haystack).includes(normalizeSearch(query));
}
