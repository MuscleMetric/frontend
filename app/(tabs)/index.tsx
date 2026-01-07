// app/(tabs)/index.tsx
import React, { useState, useEffect } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ActivityIndicator,
  View,
  Text,
  Pressable,
  AppState,
} from "react-native";
import { useAuth } from "../../lib/authContext";
import { useAppTheme } from "../../lib/useAppTheme";
import { useHomeSummary } from "../features/home/useHomeSummary";
import { HomeScreen } from "../features/home/HomeScreen";
import { HomeTransitionModal } from "../features/home/modals/HomeTransitionModal";
import { supabase } from "../../lib/supabase";

import { BirthdayModal } from "../features/home/modals/BirthdayModal";
import { ChristmasModal } from "../features/home/modals/ChristmasModal";

type Celebration = "birthday" | "christmas";

export default function HomeTabIndex() {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const { colors } = useAppTheme();

  const { summary, loading, error, refetch } = useHomeSummary(userId);

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
  // Guards
  // =========================
  if (!userId) {
    return (
      <SafeAreaView
        edges={["top"]}
        style={{ flex: 1, backgroundColor: colors.background }}
      >
        <View style={{ padding: 16 }}>
          <Text style={{ color: colors.text, fontWeight: "800" }}>
            Please log in.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loading || !summary) {
    return (
      <SafeAreaView
        edges={["top"]}
        style={{ flex: 1, backgroundColor: colors.background }}
      >
        <View
          style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
        >
          <ActivityIndicator />
          {!!error && (
            <View style={{ marginTop: 12, alignItems: "center" }}>
              <Text style={{ color: colors.subtle, fontWeight: "700" }}>
                {error}
              </Text>
              <Pressable onPress={refetch} style={{ marginTop: 10 }}>
                <Text style={{ color: colors.primary, fontWeight: "900" }}>
                  Retry
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      edges={["left", "right"]}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      {/* Transition modal */}
      <HomeTransitionModal
        visible={transitionOpen}
        transition={summary.transition}
        onClose={async () => {
          await consumeTransition();
          setTransitionOpen(false);
          refetch();
        }}
        colors={colors}
      />

      {/* Seasonal queue modals */}
      <BirthdayModal
        visible={activeCelebration === "birthday"}
        name={birthdayName}
        age={birthdayAge}
        onClose={closeCelebration}
        colors={colors}
      />

      <ChristmasModal
        visible={activeCelebration === "christmas"}
        name={christmasName}
        onClose={closeCelebration}
        colors={colors}
      />

      {/* Home */}
      <HomeScreen summary={summary} userId={userId} />
    </SafeAreaView>
  );
}
