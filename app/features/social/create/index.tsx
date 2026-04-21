// app/features/social/create/index.tsx

import React from "react";
import { View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
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
const RPC_GET_PR_EXERCISES = "get_pr_exercises_v1";

type RouteParams = {
  type?: "workout" | "pr";
};

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
    imageKey: item.workout_image_key ?? null,
    imageUri: null,
  };
}

function mapPrExerciseToSelection(exercise: any) {
  return {
    id: `${exercise.exercise_id}:${exercise.best_weight}:${exercise.best_reps}:${exercise.best_achieved_at}`,
    exerciseId: exercise.exercise_id,
    exerciseName: exercise.exercise_name,
    value: exercise.best_weight,
    reps: exercise.best_reps,
    unit: "kg",
    achievedAt: exercise.best_achieved_at,
    deltaValue: exercise.delta_weight ?? null,
    previousValue: exercise.previous_best_weight ?? null,
    estimated1RM: exercise.estimated_1rm ?? null,
    workoutHistoryId: exercise.workout_history_id ?? null,
  };
}

export default function CreatePostFlow() {
  const router = useRouter();
  const params = useLocalSearchParams<RouteParams>();
  const routeType = params.type;

  const { state, actions } = useCreatePostMachine();

  const [workouts, setWorkouts] = React.useState<any[]>([]);
  const [loadingWorkouts, setLoadingWorkouts] = React.useState(false);

  const [workoutDetail, setWorkoutDetail] = React.useState<any | null>(null);
  const [loadingWorkoutDetail, setLoadingWorkoutDetail] = React.useState(false);

  const [prExercises, setPrExercises] = React.useState<any[]>([]);
  const [loadingPrExercises, setLoadingPrExercises] = React.useState(false);

  const [selectedPrExerciseId, setSelectedPrExerciseId] = React.useState<
    string | null
  >(null);

  const [prSearchQuery, setPrSearchQuery] = React.useState("");

  async function loadPrExercises() {
    setLoadingPrExercises(true);

    const { data, error } = await supabase.rpc(RPC_GET_PR_EXERCISES, {
      p_query: null,
      p_limit: 50,
    });

    setLoadingPrExercises(false);

    if (error) {
      console.error("get_pr_exercises_v1 error:", error);
      setPrExercises([]);
      return;
    }

    setPrExercises(data?.items ?? []);
  }

  const filteredPrExercises = React.useMemo(() => {
    const q = prSearchQuery.trim().toLowerCase();
    if (!q) return prExercises;

    return prExercises.filter((item) =>
      String(item.exercise_name ?? "")
        .toLowerCase()
        .includes(q),
    );
  }, [prExercises, prSearchQuery]);

  React.useEffect(() => {
    if (state.step !== "select_pr_exercise") return;
    loadPrExercises();
  }, [state.step]);

  React.useEffect(() => {
    if (!routeType) return;
    if (state.postType === routeType) return;

    actions.choosePostType(routeType);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeType]);

  async function loadBootstrap(query: string | null) {
    setLoadingWorkouts(true);

    const { data, error } = await supabase.rpc(RPC_CREATE_POST_BOOTSTRAP, {
      p_workout_limit: 50,
      p_pr_limit: 0,
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

    setWorkoutDetail(data);
    return true;
  }

  React.useEffect(() => {
    if (state.step !== "select_workout") return;
    loadBootstrap(state.workoutSearchQuery ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.step]);

  React.useEffect(() => {
    if (state.step !== "select_workout") return;
    loadBootstrap(state.workoutSearchQuery ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.workoutSearchQuery, state.step]);

  React.useEffect(() => {
    if (state.step === "select_workout") {
      setWorkoutDetail(null);
    }

    if (state.step === "select_pr_exercise") {
      setSelectedPrExerciseId(null);
    } else {
      setPrSearchQuery("");
    }
  }, [state.step]);

  const showFallbackSheet = state.step === "sheet" && !routeType;

  return (
    <View style={{ flex: 1 }}>
      <CreatePostSheet
        visible={showFallbackSheet}
        onClose={() => router.back()}
        onChoose={(type) => actions.choosePostType(type)}
      />

      {state.step === "select_workout" && (
        <SelectWorkoutScreen
          workouts={workouts}
          selectedWorkoutId={state.workout?.workoutHistoryId ?? null}
          onSelect={(w) => actions.selectWorkout(w)}
          onBack={() => router.replace("/social")}
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

            actions.publishSuccess(postId);
          }}
          posting={state.publishStatus === "publishing"}
        />
      )}

      {(state.step === "select_pr_exercise" || state.step === "edit_pr") && (
        <EditPrPostScreen
          mode={state.step === "select_pr_exercise" ? "select" : "compose"}
          pr={state.pr}
          draft={state.prDraft}
          query={prSearchQuery}
          onChangeQuery={setPrSearchQuery}
          exercises={filteredPrExercises}
          selectedExerciseId={selectedPrExerciseId}
          onSelectExercise={(exercise) => {
            setSelectedPrExerciseId(exercise.exercise_id);
            actions.selectPr(mapPrExerciseToSelection(exercise) as any);
          }}
          onContinueFromSelection={() => {
            if (!state.pr) return;
            actions.goto("edit_pr");
          }}
          loadingExercises={loadingPrExercises}
          onBack={
            state.step === "select_pr_exercise"
              ? () => router.replace("/social")
              : actions.back
          }
          onChangeAudience={actions.setAudience}
          onChangeCaption={actions.setPrCaption}
          onPost={async () => {
            if (!state.pr) return;

            actions.publishStart();

            const { data: postId, error } = await supabase.rpc(
              RPC_CREATE_POST_V2,
              {
                p_caption: state.prDraft.caption ?? null,
                p_exercise_id: state.pr.exerciseId,
                p_post_type: "pr",
                p_pr_reps: state.pr.reps,
                p_pr_weight: state.pr.value,
                p_visibility: state.prDraft.audience,
                p_workout_history_id: state.pr.workoutHistoryId ?? null,
              },
            );

            if (error) {
              console.error("create_post_v2 PR error:", error);
              actions.publishError(error.message);
              return;
            }

            actions.publishSuccess(postId);
          }}
          posting={state.publishStatus === "publishing"}
        />
      )}

      <PostSuccessSheet
        visible={state.step === "success"}
        onClose={() => router.replace("/social")}
        onViewFeed={() => router.replace("/social")}
        onShareExternally={() => {}}
        postType={state.postType}
        workout={state.workout}
        workoutDraft={state.workoutDraft}
        pr={state.pr}
        prDraft={state.prDraft}
      />
    </View>
  );
}
