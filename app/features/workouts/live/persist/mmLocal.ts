import AsyncStorage from "@react-native-async-storage/async-storage";

export async function clearMmLiveDraftKeysForUser(
  userId: string,
  opts?: { workoutId?: string; planWorkoutId?: string | null }
) {
  const keys = await AsyncStorage.getAllKeys();

  const prefixW = `mm:liveDraft:${userId}:w:`;
  const prefixPW = `mm:liveDraft:${userId}:pw:`;

  let toRemove = keys.filter(
    (k) => k.startsWith(prefixW) || k.startsWith(prefixPW)
  );

  // Optional: only remove the relevant workout if you prefer
  if (opts?.workoutId) {
    const exact = `mm:liveDraft:${userId}:w:${opts.workoutId}`;
    toRemove =
      toRemove.filter((k) => k !== exact).length === toRemove.length
        ? toRemove // if exact not found, keep as-is
        : toRemove.filter((k) => k === exact);
  }

  if (opts?.planWorkoutId) {
    const exact = `mm:liveDraft:${userId}:pw:${opts.planWorkoutId}`;
    toRemove = [...new Set([...toRemove, exact])];
  }

  if (toRemove.length) {
    await AsyncStorage.multiRemove(toRemove);
  }

  return toRemove; // helpful for debug
}

export async function clearAllMmLiveDraftKeysForUser(userId: string) {
  const keys = await AsyncStorage.getAllKeys();
  const toRemove = keys.filter((k) => k.startsWith(`mm:liveDraft:${userId}:`));
  if (toRemove.length) await AsyncStorage.multiRemove(toRemove);
  return toRemove;
}
