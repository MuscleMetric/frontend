// lib/pendingWorkoutSync.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabase";
import { saveCompletedWorkout } from "./saveWorkout";
import type { ReviewPayload } from "./sessionStore";
import { v4 as uuidv4 } from "uuid";

const KEY = "mm_pending_workout_saves_v1";

export type PendingWorkoutJob = {
  clientSaveId: string; // uuid string
  createdAtIso: string;

  payload: ReviewPayload;
  totalDurationSec: number;
  completedAtIso: string;
  planWorkoutIdToComplete?: string | null;

  attempts: number;
  lastError?: string | null;
};

type Listener = (count: number) => void;
const listeners = new Set<Listener>();

function notify(count: number) {
  listeners.forEach((l) => l(count));
}

export function subscribePendingCount(fn: Listener) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

async function readQueue(): Promise<PendingWorkoutJob[]> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PendingWorkoutJob[]) : [];
  } catch {
    // If storage got corrupted, don't crash the app
    return [];
  }
}

async function writeQueue(q: PendingWorkoutJob[]) {
  await AsyncStorage.setItem(KEY, JSON.stringify(q));
  notify(q.length);
}

export async function getPendingCount(): Promise<number> {
  const q = await readQueue();
  return q.length;
}

export async function enqueuePendingWorkout(input: {
  payload: ReviewPayload;
  totalDurationSec: number;
  completedAt: Date;
  planWorkoutIdToComplete?: string;
}): Promise<PendingWorkoutJob> {
  const job: PendingWorkoutJob = {
    clientSaveId: uuidv4(),
    createdAtIso: new Date().toISOString(),
    payload: input.payload,
    totalDurationSec: input.totalDurationSec,
    completedAtIso: input.completedAt.toISOString(),
    planWorkoutIdToComplete: input.planWorkoutIdToComplete ?? null,
    attempts: 0,
    lastError: null,
  };

  const q = await readQueue();
  q.push(job);
  await writeQueue(q);
  return job;
}

function isAuthProblem(msg: string) {
  const m = msg.toLowerCase();
  return (
    m.includes("jwt") ||
    m.includes("token") ||
    m.includes("auth") ||
    m.includes("not authenticated") ||
    m.includes("session")
  );
}

function isNetworkProblem(msg: string) {
  const m = msg.toLowerCase();
  return (
    m.includes("network request failed") ||
    m.includes("failed to fetch") ||
    m.includes("timeout") ||
    m.includes("socket") ||
    m.includes("offline")
  );
}

/**
 * Tries to upload pending jobs in FIFO order.
 * Returns a summary so UI can show "synced X" etc if you want.
 */
export async function syncPendingWorkouts(): Promise<{
  synced: number;
  remaining: number;
  stoppedBecauseAuth: boolean;
}> {
  // quick auth check – if no session, don't thrash the network
  const { data } = await supabase.auth.getSession();
  const sess = data.session;
  if (!sess?.user?.id) {
    const q = await readQueue();
    return { synced: 0, remaining: q.length, stoppedBecauseAuth: true };
  }

  let q = await readQueue();
  if (!q.length) return { synced: 0, remaining: 0, stoppedBecauseAuth: false };

  let synced = 0;
  let stoppedBecauseAuth = false;

  // Process sequentially: simplest + safest
  const next: PendingWorkoutJob[] = [];

  for (const job of q) {
    try {
      // Attempt server save using *current* authed user id
      const uid = sess.user.id;

      await saveCompletedWorkout({
        clientSaveId: job.clientSaveId,
        payload: job.payload,
        totalDurationSec: job.totalDurationSec,
        completedAt: new Date(job.completedAtIso),
        planWorkoutIdToComplete: job.planWorkoutIdToComplete ?? undefined,
      });

      synced += 1;
      // drop the job (do not add to next[])
    } catch (e: any) {
      const msg = String(e?.message ?? "unknown");

      // record failure and keep it
      next.push({
        ...job,
        attempts: job.attempts + 1,
        lastError: msg,
      });

      // If it smells like auth expired, stop processing remaining jobs.
      if (isAuthProblem(msg)) {
        stoppedBecauseAuth = true;

        // carry the rest forward untouched
        const idx = q.indexOf(job);
        for (let j = idx + 1; j < q.length; j++) next.push(q[j]);
        break;
      }

      // Network problems: also stop early to avoid hammering
      if (isNetworkProblem(msg)) {
        const idx = q.indexOf(job);
        for (let j = idx + 1; j < q.length; j++) next.push(q[j]);
        break;
      }
    }
  }

  await writeQueue(next);
  return { synced, remaining: next.length, stoppedBecauseAuth };
}
