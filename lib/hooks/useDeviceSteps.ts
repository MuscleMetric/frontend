import * as React from "react";
import { Platform, PermissionsAndroid, AppState } from "react-native";
import { Pedometer } from "expo-sensors";

export function useDeviceSteps(initialGoal = 10000) {
  const [stepsToday, setStepsToday] = React.useState(0);
  const [stepsAvailable, setStepsAvailable] = React.useState(true);
  const [stepsGoal, setStepsGoal] = React.useState(initialGoal);

  function startOfToday() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  React.useEffect(() => {
    let sub: { remove: () => void } | null = null;
    let alive = true;

    async function askAndroidPermissionIfNeeded() {
      if (Platform.OS !== "android") return true;
      try {
        const status = await PermissionsAndroid.request(
          "android.permission.ACTIVITY_RECOGNITION"
        );
        return status === PermissionsAndroid.RESULTS.GRANTED;
      } catch { return false; }
    }

    async function loadTodayStepsOnce() {
      try {
        const available = await Pedometer.isAvailableAsync();
        if (!available) { if (alive) setStepsAvailable(false); return; }
        if (Platform.OS === "android") {
          const ok = await askAndroidPermissionIfNeeded();
          if (!ok) { if (alive) setStepsAvailable(false); return; }
        }
        const count = await Pedometer.getStepCountAsync(startOfToday(), new Date());
        if (alive) { setStepsAvailable(true); setStepsToday(count?.steps ?? 0); }
      } catch { if (alive) setStepsAvailable(false); }
    }

    loadTodayStepsOnce();
    sub = Pedometer.watchStepCount(loadTodayStepsOnce);
    const app = AppState.addEventListener("change", s => s === "active" && loadTodayStepsOnce());
    const interval = setInterval(loadTodayStepsOnce, 60_000);

    return () => { alive = false; sub?.remove(); app.remove(); clearInterval(interval); };
  }, []);

  return { stepsToday, stepsAvailable, stepsGoal, setStepsGoal };
}
