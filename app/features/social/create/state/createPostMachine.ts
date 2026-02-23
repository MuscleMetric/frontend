// app/features/social/create/state/createPostMachine.ts

import * as React from "react";
import type {
  Audience,
  CreatePostAction,
  CreatePostState,
  PostType,
  WorkoutPostTemplateId,
} from "./createPostTypes";

const DEFAULT_AUDIENCE: Audience = "followers";
const DEFAULT_WORKOUT_TEMPLATE: WorkoutPostTemplateId = "cinematic";

export const initialCreatePostState: CreatePostState = {
  step: "sheet",
  postType: null,

  workout: null,
  pr: null,

  workoutDraft: {
    templateId: DEFAULT_WORKOUT_TEMPLATE,
    caption: "",
    audience: DEFAULT_AUDIENCE,
  },
  prDraft: {
    caption: "",
    audience: DEFAULT_AUDIENCE,
  },
  textDraft: {
    text: "",
    audience: DEFAULT_AUDIENCE,
  },

  publishStatus: "idle",
  publishError: null,
  createdPostId: null,

  workoutSearchQuery: "",
};

/**
 * Step routing rules aligned to your current designs:
 * - Choose workout -> select_workout
 * - After selecting workout + Next -> edit_workout
 * - Choose pr -> edit_pr (PR selector can be added later)
 * - Success after publish -> success
 */
function stepForPostType(postType: PostType): CreatePostState["step"] {
  if (postType === "workout") return "select_workout";
  if (postType === "pr") return "edit_pr";
  return "edit_pr"; // temporary: treat text as later; you can add edit_text step if needed
}

function canGoBack(state: CreatePostState): boolean {
  return state.step !== "sheet";
}

export function createPostReducer(
  state: CreatePostState,
  action: CreatePostAction
): CreatePostState {
  switch (action.type) {
    case "RESET_ALL":
      return { ...initialCreatePostState };

    case "CLOSE_FLOW":
      return { ...initialCreatePostState, step: "sheet" };

    case "OPEN_SHEET":
      return { ...state, step: "sheet", publishStatus: "idle", publishError: null, createdPostId: null };

    case "CHOOSE_POST_TYPE": {
      const step = stepForPostType(action.postType);

      // clear previous selection when switching post types
      const cleared =
        action.postType === "workout"
          ? { pr: null }
          : action.postType === "pr"
          ? { workout: null }
          : { workout: null, pr: null };

      return {
        ...state,
        ...cleared,
        postType: action.postType,
        step,
        publishStatus: "idle",
        publishError: null,
        createdPostId: null,
      };
    }

    case "GOTO":
      return { ...state, step: action.step };

    case "BACK": {
      if (!canGoBack(state)) return state;

      // explicit back transitions, matching screens
      if (state.step === "select_workout") {
        return { ...state, step: "sheet" };
      }
      if (state.step === "edit_workout") {
        return { ...state, step: "select_workout" };
      }
      if (state.step === "edit_pr") {
        // PR flow currently comes from sheet
        return { ...state, step: "sheet" };
      }
      if (state.step === "success") {
        // after success, go back to social feed in UI; state returns to sheet
        return { ...initialCreatePostState };
      }
      return { ...state, step: "sheet" };
    }

    // workout selection
    case "SET_WORKOUT_SEARCH_QUERY":
      return { ...state, workoutSearchQuery: action.query };

    case "SELECT_WORKOUT":
      return {
        ...state,
        workout: action.workout,
        // once selected, user can proceed to editor
        step: "edit_workout",
      };

    case "CLEAR_WORKOUT_SELECTION":
      return { ...state, workout: null, step: "select_workout" };

    // pr selection
    case "SELECT_PR":
      return { ...state, pr: action.pr, step: "edit_pr" };

    case "CLEAR_PR_SELECTION":
      return { ...state, pr: null };

    // editor changes
    case "SET_AUDIENCE": {
      // apply to whichever post type is active (keeps UX simple)
      if (state.postType === "workout") {
        return {
          ...state,
          workoutDraft: { ...state.workoutDraft, audience: action.audience },
        };
      }
      if (state.postType === "pr") {
        return { ...state, prDraft: { ...state.prDraft, audience: action.audience } };
      }
      return { ...state, textDraft: { ...state.textDraft, audience: action.audience } };
    }

    case "SET_WORKOUT_TEMPLATE":
      return {
        ...state,
        workoutDraft: { ...state.workoutDraft, templateId: action.templateId },
      };

    case "SET_WORKOUT_CAPTION":
      return {
        ...state,
        workoutDraft: { ...state.workoutDraft, caption: action.caption },
      };

    case "SET_PR_CAPTION":
      return { ...state, prDraft: { ...state.prDraft, caption: action.caption } };

    case "SET_TEXT_BODY":
      return { ...state, textDraft: { ...state.textDraft, text: action.text } };

    // publishing
    case "PUBLISH_START":
      return { ...state, publishStatus: "publishing", publishError: null };

    case "PUBLISH_SUCCESS":
      return {
        ...state,
        publishStatus: "success",
        createdPostId: action.createdPostId,
        step: "success",
      };

    case "PUBLISH_ERROR":
      return { ...state, publishStatus: "error", publishError: action.message };

    case "CLEAR_PUBLISH_ERROR":
      return { ...state, publishStatus: "idle", publishError: null };

    default:
      return state;
  }
}

/**
 * Hook: useCreatePostMachine
 * Keeps all create-post flow state in one place.
 */
export function useCreatePostMachine(
  overrideInitial?: Partial<CreatePostState>
) {
  const [state, dispatch] = React.useReducer(
    createPostReducer,
    { ...initialCreatePostState, ...(overrideInitial ?? {}) }
  );

  const actions = React.useMemo(() => {
    return {
      resetAll: () => dispatch({ type: "RESET_ALL" }),
      close: () => dispatch({ type: "CLOSE_FLOW" }),
      openSheet: () => dispatch({ type: "OPEN_SHEET" }),

      choosePostType: (postType: PostType) =>
        dispatch({ type: "CHOOSE_POST_TYPE", postType }),

      back: () => dispatch({ type: "BACK" }),
      goto: (step: CreatePostState["step"]) => dispatch({ type: "GOTO", step }),

      setWorkoutSearchQuery: (query: string) =>
        dispatch({ type: "SET_WORKOUT_SEARCH_QUERY", query }),

      selectWorkout: (workout: CreatePostState["workout"]) => {
        if (!workout) return;
        dispatch({ type: "SELECT_WORKOUT", workout });
      },
      clearWorkoutSelection: () => dispatch({ type: "CLEAR_WORKOUT_SELECTION" }),

      selectPr: (pr: CreatePostState["pr"]) => {
        if (!pr) return;
        dispatch({ type: "SELECT_PR", pr });
      },
      clearPrSelection: () => dispatch({ type: "CLEAR_PR_SELECTION" }),

      setAudience: (audience: Audience) => dispatch({ type: "SET_AUDIENCE", audience }),
      setWorkoutTemplate: (templateId: WorkoutPostTemplateId) =>
        dispatch({ type: "SET_WORKOUT_TEMPLATE", templateId }),
      setWorkoutCaption: (caption: string) =>
        dispatch({ type: "SET_WORKOUT_CAPTION", caption }),
      setPrCaption: (caption: string) => dispatch({ type: "SET_PR_CAPTION", caption }),
      setTextBody: (text: string) => dispatch({ type: "SET_TEXT_BODY", text }),

      publishStart: () => dispatch({ type: "PUBLISH_START" }),
      publishSuccess: (createdPostId: string) =>
        dispatch({ type: "PUBLISH_SUCCESS", createdPostId }),
      publishError: (message: string) => dispatch({ type: "PUBLISH_ERROR", message }),
      clearPublishError: () => dispatch({ type: "CLEAR_PUBLISH_ERROR" }),
    };
  }, []);

  return { state, dispatch, actions };
}

/**
 * Minimal selectors (optional but handy)
 */
export const createPostSelectors = {
  isPublishing: (s: CreatePostState) => s.publishStatus === "publishing",
  canPostWorkout: (s: CreatePostState) =>
    s.postType === "workout" && !!s.workout && s.publishStatus !== "publishing",
  canPostPr: (s: CreatePostState) =>
    s.postType === "pr" && !!s.pr && s.publishStatus !== "publishing",
};