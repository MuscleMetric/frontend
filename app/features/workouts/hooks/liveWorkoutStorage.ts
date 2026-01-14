import AsyncStorage from "@react-native-async-storage/async-storage";
import { LiveWorkoutDraft } from "./liveWorkoutTypes";

const keyFor = (userId: string) => `live_workout:${userId}`;

export async function loadLiveWorkoutDraft(userId: string): Promise<LiveWorkoutDraft | null> {
  try {
    const raw = await AsyncStorage.getItem(keyFor(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LiveWorkoutDraft;
    if (!parsed?.draftId || parsed.userId !== userId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function saveLiveWorkoutDraft(draft: LiveWorkoutDraft): Promise<void> {
  const safe: LiveWorkoutDraft = {
    ...draft,
    updatedAt: new Date().toISOString(),
  };
  await AsyncStorage.setItem(keyFor(draft.userId), JSON.stringify(safe));
}

export async function clearLiveWorkoutDraft(userId: string): Promise<void> {
  await AsyncStorage.removeItem(keyFor(userId));
}
