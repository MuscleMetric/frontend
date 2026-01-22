import React, { useMemo } from "react";
import { ScrollView, View, RefreshControl } from "react-native";
import { router } from "expo-router";
import { Screen, ScreenHeader } from "@/ui";

import { useProgressOverview } from "../hooks/useProgressOverview";
import { mapOverview } from "../data/progress.mapper";

import ProgressSkeleton from "../components/ProgressSkeleton";
import ProgressErrorState from "../components/ProgressErrorState";

import MomentumHeroSection from "../sections/MomentumHeroSection";
import ConsistencySection from "../sections/ConsistencySection";
import StrengthHighlightsSection from "../sections/StrengthHighlightsSection";
import ExerciseSummarySection from "../sections/ExerciseSummarySection";
import RecentActivitySection from "../sections/RecentActivitySection";

export default function ProgressScreen() {
  const { data, loading, error, refresh } = useProgressOverview();

  const vm = useMemo(() => (data ? mapOverview(data) : null), [data]);

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
          <MomentumHeroSection momentum={vm.momentum} />

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
              router.push("/features/workouts/history" as any)
            }
            onOpenWorkoutHistoryDetail={(id) =>
              router.push({
                pathname: "/features/workouts/history/detail",
                params: { id },
              } as any)
            }
          />

          {/* Spacer so last card doesn't kiss the bottom nav */}
          <View style={{ height: 8 }} />
        </ScrollView>
      )}
    </Screen>
  );
}
