// app/features/workouts/screens/WorkoutsHome.tsx

import React, { useCallback, useState } from "react";
import { ScrollView, StyleSheet } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";

import { useAuth } from "@/lib/authContext";
import { useAppTheme } from "@/lib/useAppTheme";
import { Screen, LoadingScreen, ErrorState, AuthRequiredState } from "@/ui";

import { useWorkoutsTab } from "../data/useWorkoutsTab";
import type { WorkoutsTabPayload } from "../types/workoutsTab";

import { CreateWorkoutModal } from "../components/CreateWorkoutModal";

import { NewUserSetupSection } from "../sections/NewUserSetupSection";
import { SuggestedSection } from "../sections/SuggestedSection";
import { MyWorkoutsSection } from "../sections/MyWorkoutsSection";
import { ActivePlanHeroSection } from "../sections/ActivePlanHeroSection";
import { PlanScheduleSection } from "../sections/PlanScheduleSection";
import { OptionalSessionsSection } from "../sections/OptionalSessionsSection";

const ROUTES = {
  workoutPreview: "/features/workouts/screens/WorkoutOverview",
  workoutUse: "/features/workouts/screens/WorkoutOverview",
  planView: "/features/plans/history/view",
  planEdit: "/features/plans/edit",
  planCreate: "/features/workouts/screens/WorkoutOverview",
} as const;

export default function WorkoutsHome() {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  const { colors, layout } = useAppTheme();

  const { loading, error, data, refetch } = useWorkoutsTab(userId);
  const [createOpen, setCreateOpen] = useState(false);

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  if (!userId) return <AuthRequiredState />;
  if (loading) return <LoadingScreen />;
  if (error || !data) {
    return (
      <ErrorState
        title="Couldn’t load Workouts"
        message={error ?? "Unknown error"}
        onRetry={refetch}
      />
    );
  }

  return (
    <Screen>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.bg }}
        contentContainerStyle={{
          padding: layout.space.lg,
          gap: layout.space.md,
          paddingBottom: layout.space.xxl, // breathing room above tab bar
        }}
        showsVerticalScrollIndicator={false}
      >
        <StateRenderer
          payload={data}
          onOpenCreate={() => setCreateOpen(true)}
        />
      </ScrollView>

      <CreateWorkoutModal
        visible={createOpen}
        onClose={() => setCreateOpen(false)}
      />
    </Screen>
  );
}

function StateRenderer({
  payload,
  onOpenCreate,
}: {
  payload: WorkoutsTabPayload;
  onOpenCreate: () => void;
}) {
  if (payload.state === "new_user") {
    return (
      <>
        <NewUserSetupSection
          setup={payload.setup ?? null}
          onOpenCreate={onOpenCreate}
        />

        <SuggestedSection
          suggested={payload.suggested ?? null}
          onPressWorkout={(workoutId) =>
            router.push({
              pathname: ROUTES.workoutPreview,
              params: { workoutId },
            })
          }
        />

        <MyWorkoutsSection
          mode="new_user"
          myWorkouts={payload.myWorkouts}
          onOpenCreate={onOpenCreate}
          onExplorePlans={() => router.push(ROUTES.planCreate)}
          onPressWorkout={(workoutId) =>
            router.push({
              pathname: ROUTES.workoutUse,
              params: { workoutId },
            })
          }
        />
      </>
    );
  }

  if (payload.state === "no_plan") {
    return (
      <MyWorkoutsSection
        mode="no_plan"
        myWorkouts={payload.myWorkouts}
        onOpenCreate={onOpenCreate}
        onExplorePlans={() => router.push(ROUTES.planCreate)}
        onPressWorkout={(workoutId) =>
          router.push({
            pathname: ROUTES.workoutUse,
            params: { workoutId },
          })
        }
      />
    );
  }

  const activePlan = payload.activePlan;
  if (!activePlan) return null;

  return (
    <>
      <ActivePlanHeroSection
        activePlan={activePlan}
        onStartNext={({ workoutId, planWorkoutId }) =>
          router.push({
            pathname: ROUTES.workoutPreview,
            params: { workoutId, planWorkoutId },
          })
        }
      />

      {payload.planSchedule ? (
        <PlanScheduleSection
          schedule={payload.planSchedule}
          onPressWorkout={({ workoutId, planWorkoutId }) =>
            router.push({
              pathname: ROUTES.workoutPreview,
              params: { workoutId, planWorkoutId },
            })
          }
          onViewAll={() =>
            router.push({
              pathname: ROUTES.planView,
              params: { planId: activePlan.planId },
            })
          }
          onEdit={() =>
            router.push({
              pathname: ROUTES.planEdit,
              params: { planId: activePlan.planId },
            })
          }
        />
      ) : null}

      {payload.optionalSessions ? (
        <OptionalSessionsSection
          optional={payload.optionalSessions}
          onOpenCreate={onOpenCreate}
          onPressWorkout={(workoutId) =>
            router.push({ pathname: ROUTES.workoutUse, params: { workoutId } })
          }
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({});
