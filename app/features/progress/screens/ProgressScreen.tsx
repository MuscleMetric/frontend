import React, { useMemo } from "react";
import { ScrollView, View, RefreshControl } from "react-native";
import { router } from "expo-router";
import { Screen } from "@/ui";

import { useProgressOverview } from "../hooks/useProgressOverview";
import { mapOverview } from "../data/progress.mapper";

import ProgressSkeleton from "../components/ProgressSkeleton";
import ProgressErrorState from "../components/ProgressErrorState";

import MomentumHeroSection from "../sections/MomentumHeroSection";
import ConsistencySection from "../sections/ConsistencySection";
import StrengthHighlightsSection from "../sections/StrengthHighlightsSection";
import ExerciseSummarySection from "../sections/ExerciseSummarySection";
import RecentActivitySection from "../sections/RecentActivitySection";

import { NewUserProgressCard } from "@/app/features/home/ui/cards/NewUserProgressCard"; // adjust import path

const UNLOCK_TARGET = 5;

export default function ProgressScreen() {
  const { data, loading, error, refresh } = useProgressOverview();
  const vm = useMemo(() => (data ? mapOverview(data) : null), [data]);

  const workoutsTotal = data?.meta?.workouts_total ?? 0;
  const isNewUser = workoutsTotal < UNLOCK_TARGET;

  if (loading) return <ProgressSkeleton />;

  return (
    <Screen>
      {error || !vm ? (
        <ProgressErrorState onRetry={refresh} />
      ) : (
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
          {/* Always show hero */}
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
                onOpenExercise={(exerciseId) =>
                  router.push({
                    pathname: "/features/progress/screens/deep-analytics",
                    params: { exerciseId },
                  })
                }
              />

              <ExerciseSummarySection
                exerciseSummary={vm.exerciseSummary}
                onOpenExercise={(exerciseId) =>
                  router.push({
                    pathname: "/features/progress/screens/deep-analytics",
                    params: { exerciseId },
                  })
                }
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

              <View style={{ height: 8 }} />
            </>
          )}
        </ScrollView>
      )}
    </Screen>
  );
}
