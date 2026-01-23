// app/features/history/utils/history.grouping.ts

import type { HistoryListItem } from "../data/history.types";
import { addDaysLocal, sameLocalDay, startOfLocalDay } from "./history.format";

export type HistoryGroupKey =
  | "today"
  | "yesterday"
  | "this_week"
  | "last_week"
  | "older";

export type HistoryGroup = {
  key: HistoryGroupKey;
  title: string;
  items: HistoryListItem[];
};

function startOfWeekLocal(d: Date, weekStartsOnMonday = true) {
  const x = startOfLocalDay(d);
  const day = x.getDay(); // 0 Sun..6 Sat
  const mondayBased = weekStartsOnMonday ? (day + 6) % 7 : day; // Mon=0
  x.setDate(x.getDate() - mondayBased);
  return x;
}

function inRange(d: Date, minInclusive: Date, maxExclusive: Date) {
  return (
    d.getTime() >= minInclusive.getTime() &&
    d.getTime() < maxExclusive.getTime()
  );
}

export function groupHistoryItems(
  items: HistoryListItem[],
  now = new Date()
): HistoryGroup[] {
  const today = startOfLocalDay(now);
  const yesterday = addDaysLocal(today, -1);

  const thisWeekStart = startOfWeekLocal(today, true);
  const nextWeekStart = addDaysLocal(thisWeekStart, 7);

  const lastWeekStart = addDaysLocal(thisWeekStart, -7);
  const thisWeekEnd = nextWeekStart;

  const groups: Record<HistoryGroupKey, HistoryListItem[]> = {
    today: [],
    yesterday: [],
    this_week: [],
    last_week: [],
    older: [],
  };

  for (const it of items) {
    const d = new Date(it.completed_at);
    if (Number.isNaN(d.getTime())) {
      groups.older.push(it);
      continue;
    }

    if (sameLocalDay(d, today)) {
      groups.today.push(it);
      continue;
    }

    if (sameLocalDay(d, yesterday)) {
      groups.yesterday.push(it);
      continue;
    }

    if (inRange(d, thisWeekStart, thisWeekEnd)) {
      groups.this_week.push(it);
      continue;
    }

    if (inRange(d, lastWeekStart, thisWeekStart)) {
      groups.last_week.push(it);
      continue;
    }

    groups.older.push(it);
  }

  const out: HistoryGroup[] = [
    { key: "today" as const, title: "Today", items: groups.today },
    { key: "yesterday" as const, title: "Yesterday", items: groups.yesterday },
    { key: "this_week" as const, title: "This Week", items: groups.this_week },
    { key: "last_week" as const, title: "Last Week", items: groups.last_week },
    { key: "older" as const, title: "Older", items: groups.older },
  ];

  return out.filter((g) => g.items.length > 0);
}
