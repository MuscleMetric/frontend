 
// lib/liveWorkout.ts
import { Platform } from 'react-native';

type LiveActivityModule = {
  startActivity?: (attributes: any, contentState: any) => Promise<{ activityId: string }>;
  updateActivity?: (activityId: string, contentState: any) => Promise<void>;
  endActivity?: (activityId: string) => Promise<void>;
};

// Lazy, guarded requires so we don't crash if native modules aren't linked (e.g., Expo Go)
let notifee: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  notifee = require('@notifee/react-native');
} catch {}

let LiveActivity: LiveActivityModule | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  LiveActivity = require('expo-live-activity');
} catch {}

export type LivePayload = {
  startedAt: number;
  workoutTitle: string;
  currentExercise?: string;
  setLabel?: string;
  prevLabel?: string;
};

const ANDROID_NOTIFICATION_ID = 'workout-live';
const ANDROID_CHANNEL_ID = 'workout-live';
let iOSActivityId: string | null = null;


async function ensureAndroidChannel() {
  if (!notifee) {
    console.warn('[liveWorkout] Notifee not available. Did you prebuild and run a dev build?');
    return;
  }
  await notifee.requestPermission?.();
  await notifee.createChannel?.({
    id: ANDROID_CHANNEL_ID,
    name: 'Workout Live',
    importance: notifee.AndroidImportance?.HIGH,
    visibility: notifee.AndroidVisibility?.PUBLIC,
  });
}

function androidBody(p: LivePayload) {
  const parts: string[] = [];
  if (p.currentExercise) parts.push(p.currentExercise);
  if (p.setLabel) parts.push(p.setLabel);
  return parts.join(' • ');
}
function androidSubtitle(p: LivePayload) {
  return p.prevLabel || undefined;
}


export async function startLiveWorkout(p: LivePayload) {
  if (Platform.OS === 'android') {
    if (!notifee) {
      console.warn('[liveWorkout] Notifee not available. Build with `npx expo run:android`.');
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
        pressAction: { id: 'default' },
        smallIcon: 'ic_stat_name', // optional custom small icon (drawable). Remove line to use app icon.
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
      const attributes = { workoutTitle: p.workoutTitle };
      const contentState = {
        currentExercise: p.currentExercise || '',
        setLabel: p.setLabel || '',
        prevLabel: p.prevLabel || '',
        startedAt: p.startedAt,
      };
      if (!iOSActivityId) {
        const { activityId } = await LiveActivity.startActivity(attributes, contentState);
        iOSActivityId = activityId;
      } else {
        await updateLiveWorkout(p);
      }
    } catch (e) {
      console.warn('[liveWorkout] Live Activity start failed:', e);
    }
  } else if (Platform.OS === 'ios') {
    console.warn('[liveWorkout] expo-live-activity not available or not configured.');
  }
}

export async function updateLiveWorkout(p: LivePayload) {
  if (Platform.OS === 'android') {
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
      const contentState = {
        currentExercise: p.currentExercise || '',
        setLabel: p.setLabel || '',
        prevLabel: p.prevLabel || '',
        startedAt: p.startedAt,
      };
      await LiveActivity.updateActivity(iOSActivityId, contentState);
    } catch (e) {
      console.warn('[liveWorkout] Live Activity update failed:', e);
    }
  }
}

export async function stopLiveWorkout() {
  if (Platform.OS === 'android') {
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
