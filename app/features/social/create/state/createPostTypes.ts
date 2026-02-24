// app/features/social/create/state/createPostTypes.ts

export type PostType = "workout" | "pr" | "text";
export type Audience = "public" | "followers" | "private";

/**
 * Flow steps (matches your designs):
 * - sheet: Create Post bottom sheet (3 options)
 * - select_workout: Select Workout list (search + Next)
 * - edit_workout: Workout post editor (preview + caption + Post)
 * - edit_pr: PR post editor (preview + caption + Share/Post)
 * - success: Success screen/sheet (preview + view/share)
 */
export type CreatePostStep =
  | "sheet"
  | "select_workout"
  | "edit_workout"
  | "edit_pr"
  | "success";

export type WorkoutSelection = {
  workoutHistoryId: string; // completed workout session id
  workoutId?: string; // optional: base workout id (if you have it)
  title: string;
  completedAt: string; // ISO string
  durationSeconds: number | null;

  // snapshot-like summary shown in selection list & editor preview
  totalVolume: number | null;
  volumeUnit: "kg" | "lb" | null;
  totalSets: number | null;

  // for the workout card preview (top exercises)
  topExercises?: Array<{
    exerciseId: string;
    name: string;
    volume: number | null;
  }>;

  // optional background image key/uri for cinematic preview
  imageKey?: string | null;
  imageUri?: string | null;
};

export type PrSelection = {
  exerciseId: string;
  exerciseName: string;

  // what the user is sharing as the PR
  value: number;
  unit: "kg" | "lb" | "reps" | "time" | "distance";
  reps?: number | null;

  achievedAt: string; // ISO string

  // optional context for “+10kg improvement”
  previousBestValue?: number | null;
  deltaValue?: number | null;

  // optional link back to underlying set/workout evidence
  workoutHistoryId?: string | null;
  workoutSetHistoryId?: string | null;

  // PR posts in your design have NO images (keep null)
  imageUri?: null;
};

/**
 * Draft data for each post type editor.
 * Keep this minimal: preview must match final payload later, but that snapshot
 * gets assembled right before publish.
 */
export type WorkoutPostDraft = {
  caption: string;
  audience: Audience;
};

export type PrPostDraft = {
  caption: string;
  audience: Audience;
};

export type TextPostDraft = {
  text: string;
  audience: Audience;
};

export type PublishStatus = "idle" | "publishing" | "success" | "error";

export type CreatePostState = {
  step: CreatePostStep;

  // chosen post type (sheet sets this)
  postType: PostType | null;

  // selected source
  workout: WorkoutSelection | null;
  pr: PrSelection | null;

  // drafts
  workoutDraft: WorkoutPostDraft;
  prDraft: PrPostDraft;
  textDraft: TextPostDraft;

  // publishing
  publishStatus: PublishStatus;
  publishError: string | null;

  // success payload (for success screen preview + actions)
  createdPostId: string | null;

  // UX helpers
  workoutSearchQuery: string;

  // in CreatePostState type
  viewer: {
    name: string;
    username: string | null;
  } | null;
};

export type CreatePostAction =
  | { type: "RESET_ALL" }
  | { type: "CLOSE_FLOW" } // same as reset to sheet
  | { type: "OPEN_SHEET" }
  | { type: "CHOOSE_POST_TYPE"; postType: PostType }
  | { type: "BACK" }
  | { type: "GOTO"; step: CreatePostStep }

  // workout selection
  | { type: "SET_WORKOUT_SEARCH_QUERY"; query: string }
  | { type: "SELECT_WORKOUT"; workout: WorkoutSelection }
  | { type: "CLEAR_WORKOUT_SELECTION" }

  // pr selection (you may add a PR picker later, still useful)
  | { type: "SELECT_PR"; pr: PrSelection }
  | { type: "CLEAR_PR_SELECTION" }

  // editor changes
  | { type: "SET_AUDIENCE"; audience: Audience }
  | { type: "SET_WORKOUT_CAPTION"; caption: string }
  | { type: "SET_PR_CAPTION"; caption: string }
  | { type: "SET_TEXT_BODY"; text: string }

  // publishing lifecycle
  | { type: "PUBLISH_START" }
  | { type: "PUBLISH_SUCCESS"; createdPostId: string }
  | { type: "PUBLISH_ERROR"; message: string }
  | { type: "CLEAR_PUBLISH_ERROR" }
  | { type: "SET_VIEWER"; viewer: { name: string; username: string | null } }
  | { type: "CLEAR_VIEWER" };
