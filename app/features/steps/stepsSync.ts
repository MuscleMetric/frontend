import { Platform } from "react-native";
import { Pedometer } from "expo-sensors";
import * as BackgroundFetch from "expo-background-fetch";
import * as TaskManager from "expo-task-manager";
import { supabase } from "../../../lib/supabase";

const TASK_NAME = "steps-background-sync";

/** YYYY-MM-DD in *local* time */
export function toISODateLocal(d: Date) {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  const y = copy.getFullYear();
  const m = `${copy.getMonth() + 1}`.padStart(2, "0");
  const dd = `${copy.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

async function getStepsForDayLocal(day: Date) {
  const start = new Date(day);
  start.setHours(0, 0, 0, 0);
  const end = new Date(day);
  end.setHours(23, 59, 59, 999);
  const res = await Pedometer.getStepCountAsync(start, end);
  return res?.steps ?? 0;
}

async function uploadStepsForDay(dayISO: string, steps: number) {
  const { error } = await supabase.rpc("record_daily_steps", {
    p_day: dayISO,
    p_steps: steps,
  });
  if (error) throw error;
}

/** Get server-stored last synced day (creates row if missing) */
async function getLastSyncedDay(): Promise<Date | null> {
  const { data, error } = await supabase.rpc("get_steps_last_synced");
  if (error) return null;
  // data is YYYY-MM-DD
  if (!data) return null;
  const d = new Date(`${data}T00:00:00`);
  return isNaN(d.getTime()) ? null : d;
}

/** Persist new last synced day */
async function setLastSyncedDay(d: Date) {
  const dayISO = toISODateLocal(d);
  await supabase.rpc("set_steps_last_synced", { p_day: dayISO });
}

/**
 * Backfill inclusive range [fromDay..toDay] (local dates).
 * Returns the last day successfully synced (or null if none).
 */
async function backfillRange(fromDay: Date, toDay: Date): Promise<Date | null> {
  // clamp by platform capability
  const maxDays =
    Platform.OS === "ios" ? 7 : 1; // iOS Core Motion ~7 days; Android sensor 0–1 day without Google Fit
  const daysDiff = Math.floor(
    (toDay.getTime() - fromDay.getTime()) / (1000 * 60 * 60 * 24)
  );
  const effectiveDiff = Math.min(daysDiff, maxDays - 1);
  const start = new Date(toDay);
  start.setDate(toDay.getDate() - effectiveDiff);

  let lastOk: Date | null = null;
  const cursor = new Date(start);
  while (cursor <= toDay) {
    try {
      const steps = await getStepsForDayLocal(cursor);
      await uploadStepsForDay(toISODateLocal(cursor), steps);
      lastOk = new Date(cursor);
    } catch {
      // swallow and continue
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return lastOk;
}

/** Best-effort background pushes */
export async function registerBackgroundFetch() {
  try {
    const status = await BackgroundFetch.getStatusAsync();
    if (
      status === BackgroundFetch.BackgroundFetchStatus.Denied ||
      status === BackgroundFetch.BackgroundFetchStatus.Restricted
    ) {
      return;
    }
    await BackgroundFetch.registerTaskAsync(TASK_NAME, {
      minimumInterval: 15 * 60,
      stopOnTerminate: false,
      startOnBoot: true,
    });
  } catch {}
}

/**
 * Call on app active:
 *  - Backfill missing days up to yesterday (respecting platform caps)
 *  - Push today so far
 *  - Update last_synced_day
 */
export async function onAppActiveSync() {
  const now = new Date();
  const todayISO = toISODateLocal(now);

  // figure yesterday
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  // server-stored anchor
  let last = await getLastSyncedDay();

  // If unknown, assume "yesterday" (so we at least push yesterday + today)
  if (!last) {
    last = new Date(yesterday);
  }

  // If last < yesterday, backfill [last..yesterday]
  if (last <= yesterday) {
    const lastBackfilled = await backfillRange(last, yesterday);
    if (lastBackfilled) {
      await setLastSyncedDay(lastBackfilled);
    }
  }

  // Push today so far (doesn't move last_synced_day; that remains a *completed* day)
  try {
    const stepsToday = await getStepsForDayLocal(now);
    await uploadStepsForDay(todayISO, stepsToday);
  } catch {}
}

// Background task: push “today so far” silently
TaskManager.defineTask(TASK_NAME, async () => {
  try {
    const now = new Date();
    const steps = await getStepsForDayLocal(now);
    await uploadStepsForDay(toISODateLocal(now), steps);
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch {
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});
