/**
 * LiveHeader.test.tsx
 *
 * What this file tests:
 * - renders the workout title, subtitle, and timer text
 * - pressing the minimize control calls the non-destructive exit handler
 * - pressing the more-options control calls the more handler
 * - hides the more-options control when onMore is not provided
 */

import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { LiveHeader } from "@/app/features/workouts/live/ui/LiveHeader";

jest.mock("@/lib/useAppTheme", () => ({
  useAppTheme: () => ({
    colors: {
      bg: "#ffffff",
      text: "#111111",
      textMuted: "#666666",
      border: "#dddddd",
      danger: "#ef4444",
    },
    typography: {
      size: {
        h2: 22,
        sub: 14,
        body: 16,
      },
      fontFamily: {
        bold: "System",
        semibold: "System",
        regular: "System",
      },
    },
  }),
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

describe("LiveHeader", () => {
  it("renders title, subtitle, and timer text", () => {
    const { getByText, getByTestId } = render(
      <LiveHeader
        title="Push Day"
        subtitle="In Progress"
        timerText="12:34"
        onMinimize={jest.fn()}
        onMore={jest.fn()}
      />,
    );

    expect(getByText("Push Day")).toBeTruthy();
    expect(getByText("In Progress")).toBeTruthy();
    expect(getByText("12:34")).toBeTruthy();
    expect(getByTestId("live-header-minimize")).toBeTruthy();
    expect(getByTestId("live-header-more")).toBeTruthy();
  });

  it("calls onMinimize when the minimize control is pressed", () => {
    const onMinimize = jest.fn();

    const { getByTestId } = render(
      <LiveHeader
        title="Leg Day"
        subtitle="In Progress"
        timerText="04:20"
        onMinimize={onMinimize}
        onMore={jest.fn()}
      />,
    );

    fireEvent.press(getByTestId("live-header-minimize"));
    expect(onMinimize).toHaveBeenCalledTimes(1);
  });

  it("calls onMore when the more control is pressed", () => {
    const onMore = jest.fn();

    const { getByTestId } = render(
      <LiveHeader
        title="Back Day"
        subtitle="In Progress"
        timerText="09:11"
        onMinimize={jest.fn()}
        onMore={onMore}
      />,
    );

    fireEvent.press(getByTestId("live-header-more"));
    expect(onMore).toHaveBeenCalledTimes(1);
  });

  it("does not render the more control when onMore is not provided", () => {
    const { queryByTestId } = render(
      <LiveHeader
        title="Upper"
        subtitle="In Progress"
        timerText="01:23"
        onMinimize={jest.fn()}
      />,
    );

    expect(queryByTestId("live-header-more")).toBeNull();
  });
});