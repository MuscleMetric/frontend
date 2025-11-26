// lib/liveWorkout.ts
import { Platform } from "react-native";

type LiveActivityModule = {
  startActivity?: (
    attributes: any,
    contentState: any
  ) => Promise<{ activityId: string }>;
  updateActivity?: (activityId: string, contentState: any) => Promise<void>;
  endActivity?: (activityId: string) => Promise<void>;
};

// Lazy, guarded requires so we don't crash if native modules aren't linked (e.g., Expo Go)
let notifee: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  notifee = require("@notifee/react-native");
} catch {}

let LiveActivity: LiveActivityModule | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  LiveActivity = require("expo-live-activity");
} catch {}

export type LivePayload = {
  startedAt: number;
  workoutTitle: string;
  currentExercise?: string;
  setLabel?: string;
  prevLabel?: string;
};

const ANDROID_NOTIFICATION_ID = "workout-live";
const ANDROID_CHANNEL_ID = "workout-live";
let iOSActivityId: string | null = null;

// We’ll keep a fixed “target end” so the iOS timer/progress has something to count to.
// This doesn’t affect your actual workout timing logic.
const LIVE_ACTIVITY_DURATION_MS = 90 * 60 * 1000; // 90 minutes

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

export async function startLiveWorkout(p: LivePayload) {
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
        smallIcon: "ic_stat_name", // optional custom small icon (drawable). Remove line to use app icon.
        timestamp: p.startedAt,
        showChronometer: true,
        importance: notifee.AndroidImportance?.HIGH,
        visibility: notifee.AndroidVisibility?.PUBLIC,
      },
    });
    return;
  }

  // iOS — Live Activity
  if (LiveActivity?.startActivity) {
    try {
      const now = Date.now();
      const endMs = now + LIVE_ACTIVITY_DURATION_MS;

      // ⚠️ These keys MUST match LiveActivityAttributes in Swift
      const attributes = {
        name: p.workoutTitle,          // var name: String
        backgroundColor: "#000000",    // dark pill
        titleColor: "#FFFFFF",         // make title visible
        subtitleColor: "#E5E7EB",      // light grey
        progressViewTint: "#22c55e",   // green bar
        progressViewLabelColor: "#FFFFFF",
        timerType: "circular" as const,
        // you could also send padding / imagePosition later if you want
      };

      const contentState = {
        // MUST match ContentState struct:
        title: p.currentExercise || p.workoutTitle,
        subtitle:
          [p.setLabel, p.prevLabel].filter(Boolean).join(" • ") || undefined,
        timerEndDateInMilliseconds: endMs,
        progress: undefined,
        imageName: undefined,
        dynamicIslandImageName: undefined,
      };

      console.log("[liveWorkout] iOS startActivity", {
        attributes,
        contentState,
      });

      if (!iOSActivityId) {
        const { activityId } = await LiveActivity.startActivity(
          attributes,
          contentState
        );
        iOSActivityId = activityId;
      } else {
        // if something was already running, just update it
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

  if (LiveActivity?.updateActivity && iOSActivityId) {
    try {
      // Keep the same end time – just change the labels
      const endMs = Date.now() + LIVE_ACTIVITY_DURATION_MS;

      const contentState = {
        title: p.currentExercise || p.workoutTitle,
        subtitle:
          [p.setLabel, p.prevLabel].filter(Boolean).join(" • ") || undefined,
        timerEndDateInMilliseconds: endMs,
        progress: undefined,
        imageName: undefined,
        dynamicIslandImageName: undefined,
      };

      console.log("[liveWorkout] iOS updateActivity", {
        activityId: iOSActivityId,
        contentState,
      });

      await LiveActivity.updateActivity(iOSActivityId, contentState);
    } catch (e) {
      console.warn("[liveWorkout] Live Activity update failed:", e);
    }
  }
}

export async function stopLiveWorkout() {
  if (Platform.OS === "android") {
    if (!notifee) return;
    try {
      await notifee.stopForegroundService?.();
      await notifee.cancelNotification?.(ANDROID_NOTIFICATION_ID);
    } catch {}
    return;
  }

  if (LiveActivity?.endActivity && iOSActivityId) {
    try {
      await LiveActivity.endActivity(iOSActivityId);
    } catch {}
    iOSActivityId = null;
  }
}
