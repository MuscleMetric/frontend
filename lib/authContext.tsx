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
import {
  configureRevenueCat,
  logoutRevenueCat,
} from "@/lib/billing/revenuecat";

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
};

const FREE_CAPABILITIES: Capabilities = {
  maxTemplates: 5,
  maxActivePlans: 1,
  maxGoalsPerPlan: 2,
  canViewDeepAnalytics: false,
  canUseAdvancedPlanning: false,
  canUseSmartSuggestions: false,
};

const AuthContext = createContext<AuthValue | undefined>(undefined);

function normaliseCapabilities(raw: unknown): Capabilities {
  const obj =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};

  return {
    maxTemplates:
      typeof obj.maxTemplates === "number"
        ? obj.maxTemplates
        : typeof obj.max_templates === "number"
          ? (obj.max_templates as number)
          : FREE_CAPABILITIES.maxTemplates,

    maxActivePlans:
      typeof obj.maxActivePlans === "number"
        ? obj.maxActivePlans
        : typeof obj.max_active_plans === "number"
          ? (obj.max_active_plans as number)
          : FREE_CAPABILITIES.maxActivePlans,

    maxGoalsPerPlan:
      typeof obj.maxGoalsPerPlan === "number"
        ? obj.maxGoalsPerPlan
        : typeof obj.max_goals_per_plan === "number"
          ? (obj.max_goals_per_plan as number)
          : FREE_CAPABILITIES.maxGoalsPerPlan,

    canViewDeepAnalytics:
      typeof obj.canViewDeepAnalytics === "boolean"
        ? obj.canViewDeepAnalytics
        : typeof obj.can_view_deep_analytics === "boolean"
          ? (obj.can_view_deep_analytics as boolean)
          : FREE_CAPABILITIES.canViewDeepAnalytics,

    canUseAdvancedPlanning:
      typeof obj.canUseAdvancedPlanning === "boolean"
        ? obj.canUseAdvancedPlanning
        : typeof obj.can_use_advanced_planning === "boolean"
          ? (obj.can_use_advanced_planning as boolean)
          : FREE_CAPABILITIES.canUseAdvancedPlanning,

    canUseSmartSuggestions:
      typeof obj.canUseSmartSuggestions === "boolean"
        ? obj.canUseSmartSuggestions
        : typeof obj.can_use_smart_suggestions === "boolean"
          ? (obj.can_use_smart_suggestions as boolean)
          : FREE_CAPABILITIES.canUseSmartSuggestions,
  };
}

function normaliseEntitlementsRow(row: any): EntitlementSnapshot {
  return {
    tier: (row?.tier ?? "free") as EntitlementTier,
    status: (row?.status ?? "free") as EntitlementStatus,
    source: (row?.source ?? "none") as EntitlementSource,
    productCode: row?.productCode ?? row?.product_code ?? null,
    effectiveFrom: row?.effectiveFrom ?? row?.effective_from ?? null,
    effectiveUntil: row?.effectiveUntil ?? row?.effective_until ?? null,
    nextRenewalAt: row?.nextRenewalAt ?? row?.next_renewal_at ?? null,
    trialEndsAt: row?.trialEndsAt ?? row?.trial_ends_at ?? null,
    cancelledAt: row?.cancelledAt ?? row?.cancelled_at ?? null,
    lastVerifiedAt: row?.lastVerifiedAt ?? row?.last_verified_at ?? null,
    capabilities: normaliseCapabilities(row?.capabilities),
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [entitlements, setEntitlements] = useState<EntitlementSnapshot | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [entitlementsLoading, setEntitlementsLoading] = useState(false);

  const syncRunning = useRef(false);
  const lastSyncAt = useRef(0);

  // prevent stale writes if multiple fetches overlap
  const profileReqId = useRef(0);
  const entitlementReqId = useRef(0);

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

  const fetchEntitlements = useCallback(async (userId: string) => {
    const reqId = ++entitlementReqId.current;
    setEntitlementsLoading(true);

    try {
      const { data, error } = await supabase.rpc("get_my_entitlements");

      if (reqId !== entitlementReqId.current) return;

      if (error) {
        console.warn("get_my_entitlements failed:", error);
        setEntitlements(null);
        return;
      }

      if (!data) {
        setEntitlements(null);
        return;
      }

      // Depending on function return type, Supabase may give object or 1-row array
      const row = Array.isArray(data) ? data[0] : data;

      if (!row) {
        setEntitlements(null);
        return;
      }

      setEntitlements(normaliseEntitlementsRow(row));
    } catch (err) {
      if (reqId !== entitlementReqId.current) return;
      console.warn("fetchEntitlements exception:", err);
      setEntitlements(null);
    } finally {
      if (reqId === entitlementReqId.current) {
        setEntitlementsLoading(false);
      }
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    const uid = session?.user?.id;
    if (!uid) {
      setProfile(null);
      return;
    }
    await fetchProfile(uid);
  }, [fetchProfile, session?.user?.id]);

  const refreshEntitlements = useCallback(async () => {
    const uid = session?.user?.id;
    if (!uid) {
      setEntitlements(null);
      return;
    }
    await fetchEntitlements(uid);
  }, [fetchEntitlements, session?.user?.id]);

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

  useEffect(() => {
    const uid = session?.user?.id;

    if (!uid) {
      void logoutRevenueCat();
      return;
    }

    void configureRevenueCat(uid);
  }, [session?.user?.id]);

  useEffect(() => {
    if (session?.user?.id) {
      trySync();
    }
  }, [session?.user?.id, trySync]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        trySync();

        const uid = session?.user?.id;
        if (uid) {
          void fetchEntitlements(uid);
        }
      }
    });

    return () => sub.remove();
  }, [fetchEntitlements, session?.user?.id, trySync]);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (!mounted) return;

        const sess = error ? null : (data.session ?? null);
        setSession(sess);

        if (!mounted) return;
        setLoading(false);

        if (sess?.user?.id) {
          const uid = sess.user.id;

          setTimeout(() => {
            if (!mounted) return;
            void fetchProfile(uid);
            void fetchEntitlements(uid);
          }, 500);
        } else {
          setProfile(null);
          setEntitlements(null);
        }
      } catch {
        if (!mounted) return;
        setSession(null);
        setProfile(null);
        setEntitlements(null);
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
            void fetchEntitlements(uid);
          }, 500);
        } else {
          setProfile(null);
          setEntitlements(null);
        }

        if (!mounted) return;
        setLoading(false);
      },
    );

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [fetchEntitlements, fetchProfile]);

  const capabilities = entitlements?.capabilities ?? FREE_CAPABILITIES;

  const value = useMemo<AuthValue>(() => {
    const userId = session?.user?.id ?? null;

    return {
      session,
      profile,
      entitlements,
      capabilities,
      loading,
      entitlementsLoading,
      userId,
      refreshProfile,
      refreshEntitlements,
    };
  }, [
    session,
    profile,
    entitlements,
    capabilities,
    loading,
    entitlementsLoading,
    refreshProfile,
    refreshEntitlements,
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
