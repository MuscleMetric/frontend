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
  setLabel?: string; // e.g. "Set 2 of 4"
  prevLabel?: string; // e.g. "Last: 80×6kg"
};

const ANDROID_NOTIFICATION_ID = "workout-live";
const ANDROID_CHANNEL_ID = "workout-live";

// We still keep this for reference, but we won't use it as a countdown.
const LIVE_ACTIVITY_DURATION_MS = 90 * 60 * 1000; // 90 minutes

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

// Format elapsed time as MM:SS
function formatElapsed(startedAt: number): string {
  const sec = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
  const mm = String(Math.floor(sec / 60)).padStart(2, "0");
  const ss = String(sec % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

// Build the iOS Live Activity state from our payload
function buildIOSState(p: LivePayload): LiveActivityState {
  const timerText = formatElapsed(p.startedAt); // "00:02", "10:15", etc

  // We'll pack 4 lines into subtitle:
  // 1) Workout name
  // 2) Exercise name
  // 3) Set info
  // 4) Last set info
  const lines = [
    p.workoutTitle,
    p.currentExercise ?? "",
    p.setLabel ?? "",
    p.prevLabel ?? "",
  ]
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  return {
    // BIG TIMER text (we'll style this in Swift)
    title: timerText,

    // 4 lines separated by "\n" – we'll unpack them in Swift
    subtitle: lines.join("\n"),

    // IMPORTANT: no progressBar -> no green line
    // progressBar: undefined,

    // Name of your logo image in Assets.xcassets
    // e.g. add an image set called "LiveLogo"
    imageName: "LiveLogo",
    dynamicIslandImageName: "LiveLogo",
  };
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
        smallIcon: "ic_stat_name", // custom small icon (drawable) – or remove to use app icon
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
      const state = buildIOSState(p);

      const config: LiveActivityConfig = {
        backgroundColor: "#000000", // dark pill
        titleColor: "#FFFFFF", // timer color
        subtitleColor: "#E5E7EB", // 4-line text color
        // No progressViewTint -> no line anyway because we don't send progressBar
        timerType: "digital",
        imagePosition: "left", // logo on the left
        imageAlign: "top", // push it to the top on the left side
      };

      console.log("[liveWorkout] iOS startActivity", { state, config });

      if (!iOSActivityId) {
        const activityId = LiveActivity.startActivity(state, config);
        iOSActivityId = activityId ?? null;
      } else {
        await updateLiveWorkout(p);
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
      const state = buildIOSState(p);

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
      };

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
