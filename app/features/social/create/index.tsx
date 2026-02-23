import React from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";

import { useCreatePostMachine } from "./state/createPostMachine";
import { mapRpcItemToWorkoutSelection } from "./selectWorkout/mapWorkoutHistoryToSelection";

import CreatePostSheet from "./entry/CreatePostSheet";
import SelectWorkoutScreen from "./selectWorkout/SelectWorkoutScreen";
import EditWorkoutPostScreen from "./editWorkoutPost/EditWorkoutPostScreen";
import EditPrPostScreen from "./editPrPost/EditPrPostScreen";
import PostSuccessSheet from "./success/PostSuccessSheet";

const RPC_WORKOUT_HISTORY_LIST = "get_workout_history_feed";

export default function CreatePostFlow() {
  const router = useRouter();
  const { state, actions } = useCreatePostMachine();

  const [workouts, setWorkouts] = React.useState<any[]>([]);
  const [loadingWorkouts, setLoadingWorkouts] = React.useState(false);

  /**
   * Load workout history for selector
   */
  async function loadWorkouts(query: string | null) {
    setLoadingWorkouts(true);

    const { data, error } = await supabase.rpc(
      RPC_WORKOUT_HISTORY_LIST,
      {
        p_limit: 50,
        p_cursor_completed_at: null,
        p_cursor_id: null,
        p_query: query && query.trim() ? query : null,
      }
    );

    setLoadingWorkouts(false);

    if (error) {
      console.error("Workout history RPC error:", error);
      setWorkouts([]);
      return;
    }

    const unit = (data?.meta?.unit ?? "kg") as "kg" | "lb";
    const items = (data?.items ?? []) as any[];

    const mapped = items.map((it) =>
      mapRpcItemToWorkoutSelection(it, unit)
    );

    setWorkouts(mapped);
  }

  /**
   * Load when entering select_workout
   */
  React.useEffect(() => {
    if (state.step === "select_workout") {
      loadWorkouts(state.workoutSearchQuery ?? null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.step]);

  /**
   * Reload when search changes (server-side search)
   */
  React.useEffect(() => {
    if (state.step !== "select_workout") return;
    loadWorkouts(state.workoutSearchQuery ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.workoutSearchQuery]);

  return (
    <View style={{ flex: 1 }}>
      {/* ENTRY SHEET */}
      <CreatePostSheet
        visible={state.step === "sheet"}
        onClose={() => router.back()}
        onChoose={(type) => actions.choosePostType(type)}
      />

      {/* SELECT WORKOUT */}
      {state.step === "select_workout" && (
        <SelectWorkoutScreen
          workouts={workouts}
          selectedWorkoutId={state.workout?.workoutHistoryId ?? null}
          onSelect={(w) => actions.selectWorkout(w)} // only selects
          onBack={actions.back}
          onNext={() => {
            if (state.workout) {
              actions.goto("edit_workout");
            }
          }}
          query={state.workoutSearchQuery}
          onChangeQuery={actions.setWorkoutSearchQuery}
          loading={loadingWorkouts}
        />
      )}

      {/* EDIT WORKOUT */}
      {state.step === "edit_workout" && (
        <EditWorkoutPostScreen
          workout={state.workout}
          draft={state.workoutDraft}
          onBack={actions.back}
          onChangeAudience={actions.setAudience}
          onChangeTemplate={actions.setWorkoutTemplate}
          onChangeCaption={actions.setWorkoutCaption}
          onPost={async () => {
            actions.publishStart();

            // 🔥 TODO: replace with real post RPC
            setTimeout(() => {
              actions.publishSuccess("temp-id");
            }, 600);
          }}
          posting={state.publishStatus === "publishing"}
        />
      )}

      {/* EDIT PR */}
      {state.step === "edit_pr" && (
        <EditPrPostScreen
          pr={state.pr}
          draft={state.prDraft}
          onBack={actions.back}
          onChangeAudience={actions.setAudience}
          onChangeCaption={actions.setPrCaption}
          onPost={async () => {
            actions.publishStart();

            // 🔥 TODO: replace with real post RPC
            setTimeout(() => {
              actions.publishSuccess("temp-id");
            }, 600);
          }}
          posting={state.publishStatus === "publishing"}
        />
      )}

      {/* SUCCESS */}
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