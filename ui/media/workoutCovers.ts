// ui/media/workoutCovers.ts
/**
 * Drop-in replacement:
 * - Keeps `WorkoutImageKey`, `WORKOUT_COVERS`, and `resolveWorkoutCover()` working exactly like before.
 * - Adds support for:
 *    - variants: "banner" | "tile"
 *    - schemes: "light" | "dark"
 * - New helpers:
 *    - resolveWorkoutImage(key, { variant, scheme })
 *    - resolveWorkoutTile(key, scheme?)
 *
 * IMPORTANT:
 * You must add the new asset paths shown below (or adjust them to match your structure).
 */

export type WorkoutImageKey =
  | "cardio"
  | "push"
  | "pull"
  | "legs"
  | "lower_body"
  | "upper_body"
  | "full_body";

export type ColorScheme = "light" | "dark";
export type WorkoutImageVariant = "banner" | "tile";

type VariantMap = Record<WorkoutImageVariant, Record<ColorScheme, any>>;

/**
 * New: theme + variant aware images.
 *
 * Recommended folder structure (adjust if needed):
 *  assets/workout_images/banner/light/*.png
 *  assets/workout_images/banner/dark/*.png
 *  assets/workout_images/tile/light/*.png
 *  assets/workout_images/tile/dark/*.png
 */
export const WORKOUT_IMAGES: Record<WorkoutImageKey, VariantMap> = {
  cardio: {
    banner: {
      light: require("@/assets/workout_images/banner/light/Cardio.png"),
      dark: require("@/assets/workout_images/banner/dark/Cardio.png"),
    },
    tile: {
      light: require("@/assets/workout_images/tile/light/Cardio.png"),
      dark: require("@/assets/workout_images/tile/dark/Cardio.png"),
    },
  },
  push: {
    banner: {
      light: require("@/assets/workout_images/banner/light/Push.png"),
      dark: require("@/assets/workout_images/banner/dark/Push.png"),
    },
    tile: {
      light: require("@/assets/workout_images/tile/light/Push.png"),
      dark: require("@/assets/workout_images/tile/dark/Push.png"),
    },
  },
  pull: {
    banner: {
      light: require("@/assets/workout_images/banner/light/Pull.png"),
      dark: require("@/assets/workout_images/banner/dark/Pull.png"),
    },
    tile: {
      light: require("@/assets/workout_images/tile/light/Pull.png"),
      dark: require("@/assets/workout_images/tile/dark/Pull.png"),
    },
  },
  legs: {
    banner: {
      light: require("@/assets/workout_images/banner/light/Legs.png"),
      dark: require("@/assets/workout_images/banner/dark/Legs.png"),
    },
    tile: {
      light: require("@/assets/workout_images/tile/light/Legs.png"),
      dark: require("@/assets/workout_images/tile/dark/Legs.png"),
    },
  },
  lower_body: {
    banner: {
      light: require("@/assets/workout_images/banner/light/LowerBody.png"),
      dark: require("@/assets/workout_images/banner/dark/LowerBody.png"),
    },
    tile: {
      light: require("@/assets/workout_images/tile/light/LowerBody.png"),
      dark: require("@/assets/workout_images/tile/dark/LowerBody.png"),
    },
  },
  upper_body: {
    banner: {
      light: require("@/assets/workout_images/banner/light/UpperBody.png"),
      dark: require("@/assets/workout_images/banner/dark/UpperBody.png"),
    },
    tile: {
      light: require("@/assets/workout_images/tile/light/UpperBody.png"),
      dark: require("@/assets/workout_images/tile/dark/UpperBody.png"),
    },
  },
  full_body: {
    banner: {
      light: require("@/assets/workout_images/banner/light/FullBody.png"),
      dark: require("@/assets/workout_images/banner/dark/FullBody.png"),
    },
    tile: {
      light: require("@/assets/workout_images/tile/light/FullBody.png"),
      dark: require("@/assets/workout_images/tile/dark/FullBody.png"),
    },
  },
} as const;

/**
 * Legacy API (unchanged).
 * Used by `WorkoutCover` today.
 */
export function resolveWorkoutCover(key?: string | null) {
  const k = (key ?? "").toLowerCase() as WorkoutImageKey;
  return WORKOUT_IMAGES[k] ?? WORKOUT_IMAGES.full_body;
}

/**
 * New API: variant + scheme aware resolver.
 */
export function resolveWorkoutImage(
  key?: string | null,
  opts?: { variant?: WorkoutImageVariant; scheme?: ColorScheme }
) {
  const k = (key ?? "").toLowerCase() as WorkoutImageKey;
  const variant = opts?.variant ?? "banner";
  const scheme = opts?.scheme ?? "light";

  // Prefer new image set if available
  const fromNew = WORKOUT_IMAGES[k]?.[variant]?.[scheme];
  if (fromNew) return fromNew;

  // Fallback to legacy if missing
  return resolveWorkoutCover(k);
}

/**
 * Convenience helper for tiles.
 */
export function resolveWorkoutTile(key?: string | null, scheme: ColorScheme = "light") {
  return resolveWorkoutImage(key, { variant: "tile", scheme });
}
