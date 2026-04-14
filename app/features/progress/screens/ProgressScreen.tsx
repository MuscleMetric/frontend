import React, { useMemo, useState } from "react";
import { ScrollView, View, RefreshControl } from "react-native";
import { router } from "expo-router";
import { Screen } from "@/ui";

import { useProgressOverview } from "../hooks/useProgressOverview";
import { mapOverview } from "../data/progress.mapper";

import ProgressSkeleton from "../components/ProgressSkeleton";
import ProgressErrorState from "../components/ProgressErrorState";
import LockedExerciseSummaryCard from "../components/LockedExerciseSummaryCard";

import MomentumHeroSection from "../sections/MomentumHeroSection";
import ConsistencySection from "../sections/ConsistencySection";
import StrengthHighlightsSection from "../sections/StrengthHighlightsSection";
import ExerciseSummarySection from "../sections/ExerciseSummarySection";
import RecentActivitySection from "../sections/RecentActivitySection";

import { NewUserProgressCard } from "@/app/features/home/ui/cards/NewUserProgressCard";
import { useAuth } from "@/lib/authContext";
import PaywallModal from "@/app/features/paywall/components/PaywallModal";
import { usePaywallActions } from "@/lib/billing/usePaywallActions";

const UNLOCK_TARGET = 5;

export default function ProgressScreen() {
  const { data, loading, error, refresh } = useProgressOverview();
  const { capabilities } = useAuth();
  const [paywallOpen, setPaywallOpen] = useState(false);
  const { annual, monthly, purchaseSelected, restore, busy } =
    usePaywallActions(() => setPaywallOpen(false));

  const vm = useMemo(() => (data ? mapOverview(data) : null), [data]);

  const workoutsTotal = data?.meta?.workouts_total ?? 0;
  const isNewUser = workoutsTotal < UNLOCK_TARGET;

  if (loading) return <ProgressSkeleton />;

  const handleOpenDeepAnalytics = (exerciseId: string) => {
    if (capabilities.canViewDeepAnalytics) {
      router.push({
        pathname: "/features/progress/screens/deep-analytics",
        params: { exerciseId },
      });
      return;
    }

    setPaywallOpen(true);
  };

  return (
    <Screen>
      {error || !vm ? (
        <ProgressErrorState onRetry={refresh} />
      ) : (
        <>
          <ScrollView
            contentContainerStyle={{
              paddingHorizontal: 16,
              paddingTop: 12,
              paddingBottom: 24,
              gap: 12,
            }}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={loading} onRefresh={refresh} />
            }
          >
            <MomentumHeroSection momentum={vm.momentum} />

            {isNewUser ? (
              <>
                <NewUserProgressCard
                  completed={workoutsTotal}
                  target={UNLOCK_TARGET}
                />

                <RecentActivitySection
                  recent={vm.recent}
                  onOpenHistory={() =>
                    router.push("/features/progress/screens/workoutHistory")
                  }
                  onOpenWorkoutHistoryDetail={(id) =>
                    router.push({
                      pathname: "/features/progress/screens/historyDetail",
                      params: { workoutHistoryId: id },
                    } as any)
                  }
                />
              </>
            ) : (
              <>
                <ConsistencySection consistency={vm.consistency} />

                <StrengthHighlightsSection
                  highlights={vm.highlights}
                  onOpenExercise={handleOpenDeepAnalytics}
                />

                {capabilities.canViewDeepAnalytics ? (
                  <ExerciseSummarySection
                    exerciseSummary={vm.exerciseSummary}
                    onOpenExercise={(exerciseId) =>
                      router.push({
                        pathname: "/features/progress/screens/deep-analytics",
                        params: { exerciseId },
                      })
                    }
                  />
                ) : (
                  <LockedExerciseSummaryCard
                    onPress={() => setPaywallOpen(true)}
                  />
                )}

                <RecentActivitySection
                  recent={vm.recent}
                  onOpenHistory={() =>
                    router.push("/features/progress/screens/workoutHistory")
                  }
                  onOpenWorkoutHistoryDetail={(id) =>
                    router.push({
                      pathname: "/features/progress/screens/historyDetail",
                      params: { workoutHistoryId: id },
                    } as any)
                  }
                />

                <View style={{ height: 8 }} />
              </>
            )}
          </ScrollView>

          <PaywallModal
            visible={paywallOpen}
            reason="deep_analytics"
            onClose={() => setPaywallOpen(false)}
            onStartTrial={() => {
              const pkg = annual ?? monthly;
              if (!pkg || busy) return;
              void purchaseSelected(pkg);
            }}
            onRestorePurchases={() => {
              if (busy) return;
              void restore();
            }}
          />
        </>
      )}
    </Screen>
  );
}
