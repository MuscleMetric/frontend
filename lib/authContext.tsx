// lib/authContext.tsx
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { AppState } from "react-native";
import { syncPendingWorkouts } from "./pendingWorkoutSync";

export type UserRole = "user" | "pt" | "admin";

export type Profile = {
  id: string;
  name: string | null;
  email: string | null;
  onboarding_step: number;
  onboarding_completed_at: string | null;
  onboarding_dismissed_at: string | null;
  role: UserRole | null;
};

type AuthValue = {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  // optional helpers if you want them later:
  userId: string | null;
};

const AuthContext = createContext<AuthValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const syncRunning = useRef(false);
  const lastSyncAt = useRef(0);

  // prevent stale profile writes if multiple fetches overlap
  const profileReqId = useRef(0);

  const fetchProfile = useCallback(async (userId: string) => {
    const reqId = ++profileReqId.current;

    const { data, error } = await supabase
      .from("profiles")
      .select(
        "id, name, email, role, onboarding_step, onboarding_completed_at, onboarding_dismissed_at"
      )
      .eq("id", userId)
      .single();
    if (reqId !== profileReqId.current) return;

    if (error) {
      setProfile(null);
      return;
    }

    const safe: Profile = {
      id: data.id,
      name: data.name ?? null,
      email: data.email ?? null,
      role: (data.role as UserRole) ?? null,
      onboarding_step: Number(data.onboarding_step ?? 0),
      onboarding_completed_at: data.onboarding_completed_at ?? null,
      onboarding_dismissed_at: data.onboarding_dismissed_at ?? null,
    };
    setProfile(safe);
  }, []);

  const trySync = useCallback(async () => {
    const uid = session?.user?.id;
    if (!uid) return;

    const now = Date.now();
    // simple throttle (15s) to avoid repeated sync calls
    if (now - lastSyncAt.current < 15_000) return;

    if (syncRunning.current) return;
    syncRunning.current = true;
    lastSyncAt.current = now;

    try {
      await syncPendingWorkouts();
    } catch (e) {
      console.warn("syncPendingWorkouts failed:", e);
    } finally {
      syncRunning.current = false;
    }
  }, [session?.user?.id]);

  useEffect(() => {
    if (session?.user?.id) {
      trySync();
    }
  }, [session?.user?.id, trySync]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") trySync();
    });
    return () => sub.remove();
  }, [trySync]);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (!mounted) return;

        const sess = error ? null : data.session ?? null;
        setSession(sess);
        setLoading(false); // ✅ don't block on profile

        if (sess?.user?.id) fetchProfile(sess.user.id);
        else setProfile(null);
      } catch {
        if (!mounted) return;
        setSession(null);
        setProfile(null);
        setLoading(false);
      }
    }

    load();

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, sess) => {
        if (!mounted) return;

        setSession(sess ?? null);
        setLoading(false);

        if (sess?.user?.id) fetchProfile(sess.user.id);
        else setProfile(null);
      }
    );

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const value = useMemo<AuthValue>(() => {
    const userId = session?.user?.id ?? null;
    return { session, profile, loading, userId };
  }, [session, profile, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within <AuthProvider>");
  }
  return ctx;
}
