// app/features/history/utils/history.search.ts

import type { HistoryListItem } from "../data/history.types";

export function matchesHistoryQuery(item: HistoryListItem, qRaw: string) {
  const q = qRaw.trim().toLowerCase();
  if (!q) return true;

  if (item.title.toLowerCase().includes(q)) return true;

  for (const ex of item.top_items ?? []) {
    if (ex.exercise_name.toLowerCase().includes(q)) return true;
  }

  return false;
}
