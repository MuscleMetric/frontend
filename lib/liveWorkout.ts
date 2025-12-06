// lib/liveWorkout.ts
import { Platform } from "react-native";
import * as LiveActivity from "expo-live-activity"; // iOS Live Activities

// Types from expo-live-activity
type LiveActivityState = LiveActivity.LiveActivityState;
type LiveActivityConfig = LiveActivity.LiveActivityConfig;

let notifee: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  notifee = require("@notifee/react-native");
} catch {
  // Notifee not available (web / iOS / Expo Go)
}

export type LivePayload = {
  startedAt: number; // ms epoch
  workoutTitle: string;
  currentExercise?: string;
  setLabel?: string; // e.g. "Set 2 of 3"
  prevLabel?: string; // e.g. "Last: 5×100kg"
};

const ANDROID_NOTIFICATION_ID = "workout-live";
const ANDROID_CHANNEL_ID = "workout-live";

let iOSActivityId: string | null = null;

/* ---------- helpers ---------- */

async function ensureAndroidChannel() {
  if (!notifee) {
    console.warn(
      "[liveWorkout] Notifee not available. Did you prebuild and run a dev build?"
    );
    return;
  }
  await notifee.requestPermission?.();
  await notifee.createChannel?.({
    id: ANDROID_CHANNEL_ID,
    name: "Workout Live",
    importance: notifee.AndroidImportance?.HIGH,
    visibility: notifee.AndroidVisibility?.PUBLIC,
  });
}

function androidBody(p: LivePayload) {
  const parts: string[] = [];
  if (p.currentExercise) parts.push(p.currentExercise);
  if (p.setLabel) parts.push(p.setLabel);
  return parts.join(" • ");
}

function androidSubtitle(p: LivePayload) {
  return p.prevLabel || undefined;
}

// This is how long we let the ActivityKit timer run.
// We use `startedAt + LIVE_ACTIVITY_DURATION_MS` as the "end" of the interval.
const LIVE_ACTIVITY_DURATION_MS = 90 * 60 * 1000; // 90 minutes

// Build the iOS Live Activity *state* from our payload
function buildState(p: LivePayload): LiveActivityState {
  const endMs = p.startedAt + LIVE_ACTIVITY_DURATION_MS;

  return {
    // Title is still the workout name
    title: p.workoutTitle,

    // 4 lines: workout, exercise, set info, last set info
    subtitle: [
      p.workoutTitle,
      p.currentExercise ?? "",
      p.setLabel ?? "",
      p.prevLabel ?? "",
    ]
      .map((s) => s.trim())
      .filter(Boolean)
      .join("\n"),

    // expo-live-activity maps this into timerEndDateInMilliseconds
    progressBar: {
      date: endMs,
    },
    // ⛔️ no imageName / dynamicIslandImageName anymore
  } as LiveActivityState;
}

/* ---------- public API ---------- */

export async function startLiveWorkout(p: LivePayload) {
  // ---- ANDROID: foreground notification via Notifee ----
  if (Platform.OS === "android") {
    if (!notifee) {
      console.warn(
        "[liveWorkout] Notifee not available. Build with `npx expo run:android`."
      );
      return;
    }
    await ensureAndroidChannel();
    await notifee.displayNotification?.({
      id: ANDROID_NOTIFICATION_ID,
      title: p.workoutTitle,
      body: androidBody(p),
      subtitle: androidSubtitle(p),
      android: {
        channelId: ANDROID_CHANNEL_ID,
        asForegroundService: true,
        onlyAlertOnce: true,
        ongoing: true,
        pressAction: { id: "default" },
        smallIcon: "ic_stat_name", // optional custom small icon (drawable)
        timestamp: p.startedAt,
        showChronometer: true,
        importance: notifee.AndroidImportance?.HIGH,
        visibility: notifee.AndroidVisibility?.PUBLIC,
      },
    });
    return;
  }

  // ---- iOS: Live Activity via expo-live-activity ----
  if (Platform.OS === "ios" && typeof LiveActivity.startActivity === "function") {
    try {
      const state = buildState(p);

      const config: LiveActivityConfig = {
        backgroundColor: "#000000",
        titleColor: "#0c9effff",      // blue for "MuscleMetric"
        subtitleColor: "#FFFFFF",
        progressViewTint: "#22c55e",
        progressViewLabelColor: "#FFFFFF",
        timerType: "circular",
        // ⛔️ no imagePosition / imageAlign
      };

      console.log("[liveWorkout] iOS startActivity", { state, config });

      if (!iOSActivityId) {
        const activityId = LiveActivity.startActivity(state, config);
        iOSActivityId = activityId ?? null;
      } else {
        LiveActivity.updateActivity(iOSActivityId, state);
      }
    } catch (e) {
      console.warn("[liveWorkout] Live Activity start failed:", e);
    }
  } else if (Platform.OS === "ios") {
    console.warn(
      "[liveWorkout] expo-live-activity not available or not configured."
    );
  }
}

export async function updateLiveWorkout(p: LivePayload) {
  // ---- ANDROID: update foreground notification ----
  if (Platform.OS === "android") {
    if (!notifee) return;
    await notifee.displayNotification?.({
      id: ANDROID_NOTIFICATION_ID,
      title: p.workoutTitle,
      body: androidBody(p),
      subtitle: androidSubtitle(p),
      android: {
        channelId: ANDROID_CHANNEL_ID,
        asForegroundService: true,
        onlyAlertOnce: true,
        ongoing: true,
        timestamp: p.startedAt,
        showChronometer: true,
        importance: notifee.AndroidImportance?.HIGH,
        visibility: notifee.AndroidVisibility?.PUBLIC,
      },
    });
    return;
  }

  // ---- iOS: update Live Activity ----
  if (
    Platform.OS === "ios" &&
    iOSActivityId &&
    typeof LiveActivity.updateActivity === "function"
  ) {
    try {
      const state = buildState(p);

      console.log("[liveWorkout] iOS updateActivity", {
        activityId: iOSActivityId,
        state,
      });

      LiveActivity.updateActivity(iOSActivityId, state);
    } catch (e) {
      console.warn("[liveWorkout] Live Activity update failed:", e);
    }
  }
}

export async function stopLiveWorkout() {
  // ---- ANDROID: stop foreground service + notification ----
  if (Platform.OS === "android") {
    if (!notifee) return;
    try {
      await notifee.stopForegroundService?.();
      await notifee.cancelNotification?.(ANDROID_NOTIFICATION_ID);
    } catch {
      // ignore
    }
    return;
  }

  // ---- iOS: stop Live Activity ----
  if (
    Platform.OS === "ios" &&
    iOSActivityId &&
    typeof LiveActivity.stopActivity === "function"
  ) {
    try {
      const finalState: LiveActivityState = {
        title: "Workout Complete",
        subtitle: undefined,
        progressBar: { progress: 1 },
        // ⛔️ no image fields
      } as LiveActivityState;

      console.log("[liveWorkout] iOS stopActivity", {
        activityId: iOSActivityId,
        finalState,
      });

      LiveActivity.stopActivity(iOSActivityId, finalState);
    } catch (e) {
      console.warn("[liveWorkout] Live Activity stop failed:", e);
    } finally {
      iOSActivityId = null;
    }
  }
}
