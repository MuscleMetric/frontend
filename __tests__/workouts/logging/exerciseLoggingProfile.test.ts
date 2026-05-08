import {
  getLoggingType,
  getExerciseLoggingProfile,
  hasCompletedSet,
} from "@/app/features/workouts/logging/exerciseLoggingProfile";

describe("exerciseLoggingProfile", () => {
  describe("getLoggingType", () => {
    it("detects plank as timed", () => {
      expect(
        getLoggingType({
          name: "Plank",
          type: "strength",
        }),
      ).toBe("timed");
    });

    it("detects dead hang as timed", () => {
      expect(
        getLoggingType({
          name: "Dead Hang",
        }),
      ).toBe("timed");
    });

    it("detects running as cardio", () => {
      expect(
        getLoggingType({
          name: "Running",
          type: "cardio",
        }),
      ).toBe("cardio");
    });

    it("detects push-up as bodyweight", () => {
      expect(
        getLoggingType({
          name: "Push-Up",
          equipment: "Bodyweight",
        }),
      ).toBe("bodyweight_weighted");
    });

    it("detects assisted pull-up as assisted", () => {
      expect(
        getLoggingType({
          name: "Assisted Pull-Up",
        }),
      ).toBe("assisted");
    });

    it("defaults bench press to strength", () => {
      expect(
        getLoggingType({
          name: "Bench Press",
          type: "strength",
        }),
      ).toBe("strength");
    });
  });

  describe("hasCompletedSet", () => {
    it("accepts timed sets", () => {
      const profile = getExerciseLoggingProfile({
        name: "Plank",
      });

      expect(
        hasCompletedSet(profile, {
          timeSeconds: 60,
        }),
      ).toBe(true);
    });

    it("accepts bodyweight rep sets", () => {
      const profile = getExerciseLoggingProfile({
        name: "Push-Up",
        equipment: "Bodyweight",
      });

      expect(
        hasCompletedSet(profile, {
          reps: 15,
        }),
      ).toBe(true);
    });

    it("accepts cardio distance-only sets", () => {
      const profile = getExerciseLoggingProfile({
        name: "Running",
        type: "cardio",
      });

      expect(
        hasCompletedSet(profile, {
          distance: 5,
        }),
      ).toBe(true);
    });

    it("rejects empty sets", () => {
      const profile = getExerciseLoggingProfile({
        name: "Bench Press",
      });

      expect(
        hasCompletedSet(profile, {}),
      ).toBe(false);
    });
  });
});