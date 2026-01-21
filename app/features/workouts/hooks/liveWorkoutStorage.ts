import AsyncStorage from "@react-native-async-storage/async-storage";
import type { LiveWorkoutDraft } from "./liveWorkoutTypes";

// liveWorkoutStorage.ts
export const liveWorkoutDraftKeyFor = (userId: string) => `live_workout:${userId}`;

// keep existing keyFor if you want, but use the exported one everywhere
const keyFor = liveWorkoutDraftKeyFor;


export async function loadLiveDraftForUser(userId: string): Promise<LiveWorkoutDraft | null> {
  try {
    const raw = await AsyncStorage.getItem(keyFor(userId));
    if (!raw) return null;

    const parsed = JSON.parse(raw) as LiveWorkoutDraft;
    if (!parsed?.draftId) return null;
    if (parsed.userId !== userId) return null;

    return parsed;
  } catch {
    return null;
  }
}

export async function saveLiveDraftForUser(userId: string, draft: LiveWorkoutDraft): Promise<void> {
  // trust the caller's userId, but also keep the draft consistent
  const safe: LiveWorkoutDraft = {
    ...draft,
    userId,
    updatedAt: new Date().toISOString(),
  };
  await AsyncStorage.setItem(keyFor(userId), JSON.stringify(safe));
}

export async function clearLiveDraftForUser(userId: string): Promise<void> {
  await AsyncStorage.removeItem(keyFor(userId));
}

// Backwards compat with your current names:
export const loadLiveWorkoutDraft = loadLiveDraftForUser;
export async function saveLiveWorkoutDraft(draft: LiveWorkoutDraft): Promise<void> {
  return saveLiveDraftForUser(draft.userId, draft);
}
export const clearLiveWorkoutDraft = clearLiveDraftForUser;
