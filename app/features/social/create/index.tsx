// app/features/social/create/index.tsx

import React from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";

import { useCreatePostMachine } from "./state/createPostMachine";

import CreatePostSheet from "./entry/CreatePostSheet";
import SelectWorkoutScreen from "./selectWorkout/SelectWorkoutScreen";
import EditWorkoutPostScreen from "./editWorkoutPost/EditWorkoutPostScreen";
import EditPrPostScreen from "./editPrPost/EditPrPostScreen";
import PostSuccessSheet from "./success/PostSuccessSheet";

const RPC_CREATE_POST_BOOTSTRAP = "get_create_post_bootstrap_v1";
const RPC_GET_WORKOUT_FOR_POST = "get_workout_for_post_v1";
const RPC_CREATE_POST_V2 = "create_post_v2";

// map bootstrap workouts -> WorkoutSelection shape
function mapBootstrapWorkoutToSelection(item: any, unit: "kg" | "lb") {
  return {
    workoutHistoryId: item.workout_history_id,
    workoutId: item.workout_id ?? undefined,
    title: item.title ?? "Workout",
    completedAt: item.completed_at,
    durationSeconds: item.duration_seconds ?? null,
    totalVolume: item.volume_kg ?? 0,
    volumeUnit: unit,
    totalSets: item.sets_count ?? 0,
    topExercises: (item.top_exercises ?? []).slice(0, 3).map((x: any) => ({
      exerciseId: x.exercise_id,
      name: x.name,
      volume: null,
    })),

    // ✅ now supported by bootstrap
    imageKey: item.workout_image_key ?? null,
    imageUri: null,
  };
}

export default function CreatePostFlow() {
  const router = useRouter();
  const { state, actions } = useCreatePostMachine();

  const [workouts, setWorkouts] = React.useState<any[]>([]);
  const [loadingWorkouts, setLoadingWorkouts] = React.useState(false);

  // full workout detail for the edit screen (exercises + sets)
  const [workoutDetail, setWorkoutDetail] = React.useState<any | null>(null);
  const [loadingWorkoutDetail, setLoadingWorkoutDetail] = React.useState(false);

  async function loadBootstrap(query: string | null) {
    setLoadingWorkouts(true);

    const { data, error } = await supabase.rpc(RPC_CREATE_POST_BOOTSTRAP, {
      p_workout_limit: 50,
      p_pr_limit: 0, // we don't need PRs yet
      p_query: query && query.trim() ? query : null,
    });

    setLoadingWorkouts(false);

    if (error) {
      console.error("Create post bootstrap RPC error:", error);
      setWorkouts([]);
      return;
    }

    const unit = (data?.meta?.unit ?? "kg") as "kg" | "lb";
    const list = (data?.workouts ?? []) as any[];

    setWorkouts(list.map((it) => mapBootstrapWorkoutToSelection(it, unit)));
  }

  async function loadWorkoutDetail(workoutHistoryId: string) {
    setLoadingWorkoutDetail(true);

    const { data, error } = await supabase.rpc(RPC_GET_WORKOUT_FOR_POST, {
      p_workout_history_id: workoutHistoryId,
    });

    setLoadingWorkoutDetail(false);

    if (error) {
      console.error("get_workout_for_post_v1 error:", error);
      setWorkoutDetail(null);
      return false;
    }

    console.log("Workout detail RPC result:", data);

    setWorkoutDetail(data);
    return true;
  }

  // Load bootstrap when entering select_workout
  React.useEffect(() => {
    if (state.step !== "select_workout") return;
    loadBootstrap(state.workoutSearchQuery ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.step]);

  // Reload bootstrap on search while on select_workout
  React.useEffect(() => {
    if (state.step !== "select_workout") return;
    loadBootstrap(state.workoutSearchQuery ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.workoutSearchQuery, state.step]);

  // Clear detail when returning to selector (so edit always uses correct selected workout)
  React.useEffect(() => {
    if (state.step === "select_workout") setWorkoutDetail(null);
  }, [state.step]);

  return (
    <View style={{ flex: 1 }}>
      <CreatePostSheet
        visible={state.step === "sheet"}
        onClose={() => router.back()}
        onChoose={(type) => actions.choosePostType(type)}
      />

      {state.step === "select_workout" && (
        <SelectWorkoutScreen
          workouts={workouts}
          selectedWorkoutId={state.workout?.workoutHistoryId ?? null}
          onSelect={(w) => actions.selectWorkout(w)}
          onBack={actions.back}
          onNext={async () => {
            const id = state.workout?.workoutHistoryId;
            if (!id) return;

            const ok = await loadWorkoutDetail(id);
            if (ok) actions.goto("edit_workout");
          }}
          query={state.workoutSearchQuery}
          onChangeQuery={actions.setWorkoutSearchQuery}
          loading={loadingWorkouts || loadingWorkoutDetail}
        />
      )}

      {state.step === "edit_workout" && (
        <EditWorkoutPostScreen
          workout={state.workout}
          workoutDetail={workoutDetail} 
          draft={state.workoutDraft}
          onBack={actions.back}
          onChangeAudience={actions.setAudience}
          onChangeCaption={actions.setWorkoutCaption}
          onPost={async () => {
            if (!state.workout?.workoutHistoryId) return;

            actions.publishStart();

            const { data: postId, error } = await supabase.rpc(
              RPC_CREATE_POST_V2,
              {
                p_caption: state.workoutDraft.caption ?? null,
                p_exercise_id: null,
                p_post_type: "workout",
                p_pr_reps: null,
                p_pr_weight: null,
                p_visibility: state.workoutDraft.audience,
                p_workout_history_id: state.workout.workoutHistoryId,
              },
            );

            if (error) {
              console.error("create_post_v2 error:", error);
              actions.publishError(error.message);
              return;
            }

            // ✅ real UUID from DB insert
            actions.publishSuccess(postId);
          }}
          posting={state.publishStatus === "publishing"}
        />
      )}

      {state.step === "edit_pr" && (
        <EditPrPostScreen
          pr={state.pr}
          draft={state.prDraft}
          onBack={actions.back}
          onChangeAudience={actions.setAudience}
          onChangeCaption={actions.setPrCaption}
          onPost={async () => {
            actions.publishStart();
            setTimeout(() => {
              actions.publishSuccess("temp-id");
            }, 600);
          }}
          posting={state.publishStatus === "publishing"}
        />
      )}

      <PostSuccessSheet
        visible={state.step === "success"}
        onClose={() => router.replace("/(tabs)/social")}
        onViewFeed={() => router.replace("/(tabs)/social")}
        onShareExternally={() => {
          // TODO: implement share logic
        }}
        postType={state.postType}
        workout={state.workout}
        workoutDraft={state.workoutDraft}
        pr={state.pr}
        prDraft={state.prDraft}
      />
    </View>
  );
}
