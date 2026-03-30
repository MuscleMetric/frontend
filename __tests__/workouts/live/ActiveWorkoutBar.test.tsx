/**
 * ActiveWorkoutBar.test.tsx
 *
 * What this file tests:
 * - renders when there is an active workout draft
 * - shows the workout title and timer text
 * - hides on suppressed routes (live/review/auth/onboarding)
 * - pressing the bar calls resumeWorkout
 * - does not render when there is no active workout or while loading
 */

import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { ActiveWorkoutBar } from "@/app/features/workouts/live/session/ActiveWorkoutBar";

const mockUsePathname = jest.fn();
const mockUseActiveWorkoutSession = jest.fn();

jest.mock("expo-router", () => ({
  usePathname: () => mockUsePathname(),
}));

jest.mock(
  "@/app/features/workouts/live/session/useActiveWorkoutSession",
  () => ({
    useActiveWorkoutSession: () => mockUseActiveWorkoutSession(),
  }),
);

jest.mock("@/lib/useAppTheme", () => ({
  useAppTheme: () => ({
    colors: {
      bg: "#ffffff",
      surface: "#f8f8f8",
      border: "#dddddd",
      text: "#111111",
      textMuted: "#666666",
      primary: "#2563eb",
    },
    typography: {
      size: {
        body: 16,
        sub: 13,
        meta: 12,
      },
      fontFamily: {
        bold: "System",
        semibold: "System",
        medium: "System",
        regular: "System",
      },
    },
  }),
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

describe("ActiveWorkoutBar", () => {
  const resumeWorkout = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    mockUsePathname.mockReturnValue("/(tabs)/workout");
    mockUseActiveWorkoutSession.mockReturnValue({
      activeDraft: {
        draftId: "draft-1",
        userId: "user-1",
        title: "Push Day",
        workoutId: "workout-1",
        planWorkoutId: null,
      },
      hasActiveWorkout: true,
      timerText: "12:34",
      elapsedSeconds: 754,
      loading: false,
      refresh: jest.fn(),
      clearSnapshot: jest.fn(),
      resumeWorkout,
    });
  });

  it("renders the title and timer when an active workout exists", () => {
    const { getByText } = render(<ActiveWorkoutBar />);

    expect(getByText("Push Day")).toBeTruthy();
    expect(getByText("Workout active")).toBeTruthy();
    expect(getByText("12:34")).toBeTruthy();
    expect(getByText("Resume")).toBeTruthy();
  });

  it("calls resumeWorkout when pressed", () => {
    const { getByText } = render(<ActiveWorkoutBar />);

    fireEvent.press(getByText("Push Day"));
    expect(resumeWorkout).toHaveBeenCalledTimes(1);
  });

  it("hides on the live workout route", () => {
    mockUsePathname.mockReturnValue("/features/workouts/live");

    const { queryByText } = render(<ActiveWorkoutBar />);
    expect(queryByText("Push Day")).toBeNull();
  });

  it("hides on the review route", () => {
    mockUsePathname.mockReturnValue("/features/workouts/review");

    const { queryByText } = render(<ActiveWorkoutBar />);
    expect(queryByText("Push Day")).toBeNull();
  });

  it("hides on auth routes", () => {
    mockUsePathname.mockReturnValue("/(auth)/login");

    const { queryByText } = render(<ActiveWorkoutBar />);
    expect(queryByText("Push Day")).toBeNull();
  });

  it("hides on onboarding routes", () => {
    mockUsePathname.mockReturnValue("/onboarding/stage2");

    const { queryByText } = render(<ActiveWorkoutBar />);
    expect(queryByText("Push Day")).toBeNull();
  });

  it("does not render when loading", () => {
    mockUseActiveWorkoutSession.mockReturnValue({
      activeDraft: {
        draftId: "draft-1",
        userId: "user-1",
        title: "Push Day",
      },
      hasActiveWorkout: true,
      timerText: "12:34",
      elapsedSeconds: 754,
      loading: true,
      refresh: jest.fn(),
      clearSnapshot: jest.fn(),
      resumeWorkout,
    });

    const { queryByText } = render(<ActiveWorkoutBar />);
    expect(queryByText("Push Day")).toBeNull();
  });

  it("does not render when there is no active workout", () => {
    mockUseActiveWorkoutSession.mockReturnValue({
      activeDraft: null,
      hasActiveWorkout: false,
      timerText: "00:00",
      elapsedSeconds: 0,
      loading: false,
      refresh: jest.fn(),
      clearSnapshot: jest.fn(),
      resumeWorkout,
    });

    const { queryByText } = render(<ActiveWorkoutBar />);
    expect(queryByText("Workout active")).toBeNull();
  });
});