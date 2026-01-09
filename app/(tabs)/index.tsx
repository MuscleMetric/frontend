// app/(tabs)/index.tsx
import React, { useMemo, useState, useEffect } from "react";
import { AppState, View } from "react-native";
import { useAuth } from "../../lib/authContext";
import { useAppTheme } from "../../lib/useAppTheme";
import { useHomeSummary } from "../features/home/useHomeSummary";
import { HomeScreen } from "../features/home/HomeScreen";
import { HomeTransitionModal } from "../features/home/modals/HomeTransitionModal";
import { OnboardingWizard } from "../features/onboarding/OnboardingWizard";
import { supabase } from "../../lib/supabase";

import { BirthdayModal } from "../features/home/modals/BirthdayModal";
import { ChristmasModal } from "../features/home/modals/ChristmasModal";

import { Screen, AuthRequiredState, LoadingScreen, ErrorState } from "@/ui";

type Celebration = "birthday" | "christmas";

export default function HomeTabIndex() {
  const { session, profile } = useAuth();
  const userId = session?.user?.id ?? null;

  const { colors } = useAppTheme();
  const { summary, loading, error, refetch } = useHomeSummary(userId);

  // ✅ local guard so once they finish, they’re not forced again on this session
  const [onboardingDoneLocal, setOnboardingDoneLocal] = useState(false);

  // ✅ reset local flag when user changes
  useEffect(() => {
    setOnboardingDoneLocal(false);
  }, [userId]);

  const shouldShowOnboarding = useMemo(() => {
    if (!profile) return false;
    if (onboardingDoneLocal) return false;
    return !profile.onboarding_completed_at;
  }, [profile, onboardingDoneLocal]);

  // =========================
  // Transition modal (server-owned)
  // =========================
  const [transitionOpen, setTransitionOpen] = useState(false);

  useEffect(() => {
    if (summary?.transition) setTransitionOpen(true);
  }, [summary?.transition?.id]);

  async function consumeTransition() {
    if (!summary?.transition?.id || !userId) return;
    await supabase
      .from("user_events")
      .update({ consumed_at: new Date().toISOString() })
      .eq("id", summary.transition.id)
      .eq("user_id", userId);
  }

  // =========================
  // Seasonal modals (birthday + christmas)
  // =========================
  const [celebrationQueue, setCelebrationQueue] = useState<Celebration[]>([]);
  const [activeCelebration, setActiveCelebration] =
    useState<Celebration | null>(null);

  const [birthdayName, setBirthdayName] = useState<string | null>(null);
  const [birthdayAge, setBirthdayAge] = useState<number | null>(null);

  const [christmasName, setChristmasName] = useState<string | null>(null);

  function enqueueCelebration(type: Celebration) {
    setCelebrationQueue((q) => {
      if (q.includes(type)) return q;
      const rank: Record<Celebration, number> = { birthday: 0, christmas: 1 };
      return [...q, type].sort((a, b) => rank[a] - rank[b]);
    });
  }

  function startNextCelebration() {
    setCelebrationQueue((q) => {
      if (q.length === 0) {
        setActiveCelebration(null);
        return q;
      }
      const [next, ...rest] = q;
      setActiveCelebration(next);
      return rest;
    });
  }

  function closeCelebration() {
    setActiveCelebration(null);
    setTimeout(() => startNextCelebration(), 200);
  }

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;

    async function checkBirthday() {
      try {
        const { data, error } = await supabase.rpc("birthday_check_and_mark");
        if (cancelled) return;
        if (error) return;

        if (data?.shouldShow) {
          setBirthdayName(typeof data.name === "string" ? data.name : null);
          setBirthdayAge(typeof data.age === "number" ? data.age : null);
          enqueueCelebration("birthday");
        }
      } catch {}
    }

    async function checkChristmas() {
      try {
        const { data, error } = await supabase.rpc("christmas_check_and_mark");
        if (cancelled) return;
        if (error) return;

        if (data?.shouldShow) {
          setChristmasName(typeof data.name === "string" ? data.name : null);
          enqueueCelebration("christmas");
        }
      } catch {}
    }

    checkBirthday();
    checkChristmas();

    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") {
        checkBirthday();
        checkChristmas();
      }
    });

    return () => {
      cancelled = true;
      sub?.remove?.();
    };
  }, [userId]);

  useEffect(() => {
    if (!transitionOpen && !activeCelebration && celebrationQueue.length > 0) {
      startNextCelebration();
    }
  }, [celebrationQueue, activeCelebration, transitionOpen]);

  // =========================
  // Guards (now consistent)
  // =========================
  if (!userId) {
    return (
      <Screen edges={["top"]}>
        <AuthRequiredState />
      </Screen>
    );
  }

  if (loading || !summary) {
    // If we have an error, show error state with retry.
    if (error) {
      return (
        <Screen edges={["top"]}>
          <View style={{ flex: 1, justifyContent: "center" }}>
            <ErrorState
              title="Couldn’t load Home"
              message={error}
              onRetry={refetch}
            />
          </View>
        </Screen>
      );
    }

    return (
      <Screen edges={["top"]}>
        <LoadingScreen message="Loading your dashboard…" />
      </Screen>
    );
  }

  return (
    <Screen edges={["left", "right"]}>

      <HomeTransitionModal
        visible={transitionOpen}
        transition={summary.transition}
        onClose={async () => {
          await consumeTransition();
          setTransitionOpen(false);
          refetch();
        }}
      />

      <BirthdayModal
        visible={activeCelebration === "birthday"}
        name={birthdayName}
        age={birthdayAge}
        onClose={closeCelebration}
      />

      <ChristmasModal
        visible={activeCelebration === "christmas"}
        name={christmasName}
        onClose={closeCelebration}
      />

      <HomeScreen summary={summary} userId={userId} />

      <OnboardingWizard
        visible={shouldShowOnboarding}
        onFinished={() => {
          setOnboardingDoneLocal(true);
          refetch();
        }}
      />
    </Screen>
  );
}
