/**
 * HomeTabIndex (app/(tabs)/index.tsx)
 *
 * Orchestrator only. No UI decisions for Home variants live here.
 */

// app/(tabs)/index.tsx
import React, {
  useMemo,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { AppState, View } from "react-native";
import { useAuth } from "../../lib/authContext";
import { useHomeSummary } from "../features/home/useHomeSummary";
import { HomeRoot } from "../features/home/HomeRoot";
import { HomeTransitionModal } from "../features/home/modals/HomeTransitionModal";
import { supabase } from "../../lib/supabase";

import { BirthdayModal } from "../features/home/modals/BirthdayModal";
import { ChristmasModal } from "../features/home/modals/ChristmasModal";
import AchievementUnlockedModal, {
  type UnlockedAchievement,
} from "../features/home/modals/AchievementUnlockedModal";

import { Screen, AuthRequiredState, LoadingScreen, ErrorState } from "@/ui";

type Celebration = "birthday" | "christmas";

export default function HomeTabIndex() {
  const { session, profile } = useAuth();
  const userId = session?.user?.id ?? null;

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

  // =========================
  // Achievement unlocked modal (server-awarded via RPC)
  // =========================
  const [achievementQueue, setAchievementQueue] = useState<
    UnlockedAchievement[]
  >([]);
  const [activeAchievement, setActiveAchievement] =
    useState<UnlockedAchievement | null>(null);

  // Start seasonal queue when safe (no transition + no achievement modal + no other seasonal modal)
  useEffect(() => {
    if (
      !transitionOpen &&
      !activeAchievement &&
      !activeCelebration &&
      celebrationQueue.length > 0
    ) {
      startNextCelebration();
    }
  }, [celebrationQueue, activeCelebration, transitionOpen, activeAchievement]);

  const lastAchievementCheckRef = useRef<number>(0);

  const enqueueAchievements = useCallback((arr: any[]) => {
    const items: UnlockedAchievement[] = arr
      .map((x) => ({
        id: String(x?.id ?? ""),
        code: x?.code ? String(x.code) : undefined,
        title: String(x?.title ?? "Achievement unlocked"),
        description: x?.description == null ? null : String(x.description),
        category: x?.category == null ? null : String(x.category),
        difficulty: x?.difficulty == null ? null : String(x.difficulty),
        achieved_at: x?.achieved_at == null ? null : String(x.achieved_at),
      }))
      .filter((x) => !!x.id);

    if (items.length === 0) return;

    setAchievementQueue((q) => {
      // de-dupe by id
      const seen = new Set(q.map((a) => a.id));
      const merged = [...q];
      for (const it of items) if (!seen.has(it.id)) merged.push(it);
      return merged;
    });
  }, []);

  const tryStartNextAchievement = useCallback(() => {
    // priority: achievement modal should never overlap transition/seasonal/another achievement
    if (transitionOpen) return;
    if (activeCelebration) return;
    if (activeAchievement) return;

    setAchievementQueue((q) => {
      if (q.length === 0) return q;
      const [next, ...rest] = q;
      setActiveAchievement(next);
      return rest;
    });
  }, [transitionOpen, activeCelebration, activeAchievement]);

  const closeAchievement = useCallback(() => {
    setActiveAchievement(null);
    setTimeout(() => tryStartNextAchievement(), 200);
  }, [tryStartNextAchievement]);

  const checkAchievements = useCallback(async () => {
    if (!userId) return;

    // avoid spamming (home can refocus a lot)
    const now = Date.now();
    if (now - lastAchievementCheckRef.current < 25_000) return;
    lastAchievementCheckRef.current = now;

    try {
      const { data, error } = await supabase.rpc(
        "check_and_award_achievements_home_v2"
      );
      if (error) return;

      // expects: { new_count, newly_unlocked: [...] }
      if (data?.new_count > 0 && Array.isArray(data?.newly_unlocked)) {
        enqueueAchievements(data.newly_unlocked);
      }
    } catch {}
  }, [userId, enqueueAchievements]);

  // run on mount + on app foreground
  useEffect(() => {
    if (!userId) return;

    let cancelled = false;

    (async () => {
      if (cancelled) return;
      await checkAchievements();
      tryStartNextAchievement();
    })();

    const sub = AppState.addEventListener("change", async (s) => {
      if (s === "active") {
        await checkAchievements();
        tryStartNextAchievement();
      }
    });

    return () => {
      cancelled = true;
      sub?.remove?.();
    };
  }, [userId, checkAchievements, tryStartNextAchievement]);

  // if queue changes and we're safe, start showing achievements
  useEffect(() => {
    if (achievementQueue.length > 0) {
      tryStartNextAchievement();
    }
  }, [achievementQueue.length, tryStartNextAchievement]);

  // =========================
  // Guards (consistent)
  // =========================
  if (!userId) {
    return (
      <Screen edges={["top"]}>
        <AuthRequiredState />
      </Screen>
    );
  }

  if (loading || !summary) {
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

          // once transition closes, try show achievements first (priority)
          setTimeout(() => tryStartNextAchievement(), 50);
        }}
      />

      <AchievementUnlockedModal
        visible={!!activeAchievement}
        achievement={activeAchievement}
        onClose={closeAchievement}
        onViewAll={undefined}
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

      <HomeRoot summary={summary} userId={userId} />

      {/* <OnboardingWizard
        visible={shouldShowOnboarding}
        onFinished={() => {
          setOnboardingDoneLocal(true);
          refetch();
        }}
      /> */}
    </Screen>
  );
}
