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
import { AppState } from "react-native";

import { supabase } from "./supabase";
import { syncPendingWorkouts } from "./pendingWorkoutSync";

export type UserRole = "user" | "pt" | "admin";

export type Profile = {
  id: string;
  name: string | null;
  username: string | null;
  email: string | null;
  onboarding_step: number;
  onboarding_completed_at: string | null;
  onboarding_dismissed_at: string | null;
  role: UserRole | null;
};

export type EntitlementTier = "free" | "pro";

export type EntitlementStatus =
  | "free"
  | "trial"
  | "active"
  | "cancelled_active"
  | "grace"
  | "expired"
  | "revoked";

export type EntitlementSource =
  | "none"
  | "apple"
  | "google"
  | "stripe"
  | "manual";

export type Capabilities = {
  maxTemplates: number;
  maxActivePlans: number;
  maxGoalsPerPlan: number;
  canViewDeepAnalytics: boolean;
  canUseAdvancedPlanning: boolean;
  canUseSmartSuggestions: boolean;
};

export type EntitlementSnapshot = {
  tier: EntitlementTier;
  status: EntitlementStatus;
  source: EntitlementSource;
  productCode: string | null;
  effectiveFrom: string | null;
  effectiveUntil: string | null;
  nextRenewalAt: string | null;
  trialEndsAt: string | null;
  cancelledAt: string | null;
  lastVerifiedAt: string | null;
  capabilities: Capabilities;
};

type AuthValue = {
  session: Session | null;
  profile: Profile | null;
  entitlements: EntitlementSnapshot | null;
  capabilities: Capabilities;
  loading: boolean;
  entitlementsLoading: boolean;
  userId: string | null;
  refreshProfile: () => Promise<void>;
  refreshEntitlements: () => Promise<void>;
  signOut: () => Promise<void>;
  billingReady: boolean;
};

/**
 * MuscleMetric is currently free.
 *
 * Keep the existing capability shape so older screens do not need to be
 * rewritten at the same time, but do not derive access from subscriptions.
 *
 * The numeric limits are deliberately high so legacy limit checks cannot
 * block normal app usage.
 */
const FREE_CAPABILITIES: Capabilities = {
  maxTemplates: Number.MAX_SAFE_INTEGER,
  maxActivePlans: Number.MAX_SAFE_INTEGER,
  maxGoalsPerPlan: Number.MAX_SAFE_INTEGER,
  canViewDeepAnalytics: true,
  canUseAdvancedPlanning: true,
  canUseSmartSuggestions: true,
};

/**
 * Compatibility snapshot for screens that still inspect entitlement data.
 * This does not represent a subscription and performs no billing lookup.
 */
const FREE_ENTITLEMENTS: EntitlementSnapshot = {
  tier: "free",
  status: "free",
  source: "none",
  productCode: null,
  effectiveFrom: null,
  effectiveUntil: null,
  nextRenewalAt: null,
  trialEndsAt: null,
  cancelledAt: null,
  lastVerifiedAt: null,
  capabilities: FREE_CAPABILITIES,
};

const AuthContext = createContext<AuthValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const syncRunning = useRef(false);
  const lastSyncAt = useRef(0);

  // Prevent stale profile writes if multiple fetches overlap.
  const profileReqId = useRef(0);

  const fetchProfile = useCallback(async (userId: string) => {
    const reqId = ++profileReqId.current;

    const { data, error } = await supabase
      .from("profiles")
      .select(
        "id, name, username, email, role, onboarding_step, onboarding_completed_at, onboarding_dismissed_at",
      )
      .eq("id", userId)
      .single();

    if (reqId !== profileReqId.current) return;

    if (error || !data) {
      setProfile(null);
      return;
    }

    const safe: Profile = {
      id: data.id,
      name: data.name ?? null,
      username: data.username ?? null,
      email: data.email ?? null,
      role: (data.role as UserRole) ?? null,
      onboarding_step: Number(data.onboarding_step ?? 0),
      onboarding_completed_at: data.onboarding_completed_at ?? null,
      onboarding_dismissed_at: data.onboarding_dismissed_at ?? null,
    };

    setProfile(safe);
  }, []);

  const refreshProfile = useCallback(async () => {
    const uid = session?.user?.id;

    if (!uid) {
      setProfile(null);
      return;
    }

    await fetchProfile(uid);
  }, [fetchProfile, session?.user?.id]);

  /**
   * Kept for compatibility with screens that still call refreshEntitlements().
   * MuscleMetric no longer needs to contact Supabase or RevenueCat to
   * determine feature access.
   */
  const refreshEntitlements = useCallback(async () => {
    return;
  }, []);

  const signOut = useCallback(async () => {
    profileReqId.current += 1;

    setSession(null);
    setProfile(null);
    setLoading(false);

    try {
      const { error } = await supabase.auth.signOut({ scope: "local" });

      if (error && error.message !== "Auth session missing!") {
        console.warn("supabase signOut failed:", error);
      }
    } catch (e: any) {
      if (e?.message !== "Auth session missing!") {
        console.warn("supabase signOut exception:", e);
      }
    }
  }, []);

  const trySync = useCallback(async () => {
    const uid = session?.user?.id;
    if (!uid) return;

    const now = Date.now();

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

  // Sync pending workouts when a signed-in user becomes available.
  useEffect(() => {
    if (session?.user?.id) {
      void trySync();
    }
  }, [session?.user?.id, trySync]);

  // Sync pending workouts when the app returns to the foreground.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void trySync();
      }
    });

    return () => sub.remove();
  }, [trySync]);

  // Load the initial Supabase session and listen for auth changes.
  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const { data, error } = await supabase.auth.getSession();

        if (!mounted) return;

        const sess = error ? null : (data.session ?? null);

        setSession(sess);
        setLoading(false);

        if (sess?.user?.id) {
          const uid = sess.user.id;

          setTimeout(() => {
            if (!mounted) return;
            void fetchProfile(uid);
          }, 500);
        } else {
          setProfile(null);
        }
      } catch {
        if (!mounted) return;

        setSession(null);
        setProfile(null);
        setLoading(false);
      }
    }

    void load();

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (_event, sess) => {
        if (!mounted) return;

        setSession(sess ?? null);
        setLoading(false);

        if (sess?.user?.id) {
          const uid = sess.user.id;

          setTimeout(() => {
            if (!mounted) return;
            void fetchProfile(uid);
          }, 500);
        } else {
          setProfile(null);
        }
      },
    );

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const value = useMemo<AuthValue>(() => {
    const userId = session?.user?.id ?? null;

    return {
      session,
      profile,

      // Compatibility values only. No subscription lookup occurs.
      entitlements: FREE_ENTITLEMENTS,
      capabilities: FREE_CAPABILITIES,
      entitlementsLoading: false,
      billingReady: true,

      loading,
      userId,
      refreshProfile,
      refreshEntitlements,
      signOut,
    };
  }, [
    session,
    profile,
    loading,
    refreshProfile,
    refreshEntitlements,
    signOut,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);

  if (!ctx) {
    throw new Error("useAuth must be used within <AuthProvider>");
  }

  return ctx;
}