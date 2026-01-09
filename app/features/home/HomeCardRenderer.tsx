// app/features/home/HomeCardRenderer.tsx
import React from "react";
import { HeroCard } from "./ui/cards/HeroCard";
import { WeeklyGoalCard } from "./ui/cards/WeeklyGoalCard";
import { LatestPRCard } from "./ui/cards/LatestPRCard";
import { StreakCard } from "./ui/cards/StreakCard";
import { VolumeTrendCard } from "./ui/cards/VolumeTrendCard";
import { PlanGoalsCard } from "./ui/cards/PlanGoalsCard";
import { LastWorkoutCard } from "./ui/cards/LastWorkoutCard";

export function HomeCardRenderer({ card, summary }: { card: any; summary: any }) {
  switch (card?.type) {
    case "hero":
      return <HeroCard card={card} summary={summary} />;
    case "weekly_goal":
      return <WeeklyGoalCard card={card} summary={summary} />;
    case "latest_pr":
      return <LatestPRCard card={card} summary={summary} />;
    case "streak":
      return <StreakCard card={card} summary={summary} />;
    case "volume_trend":
      return <VolumeTrendCard card={card} summary={summary} />;
    case "plan_goals":
      return <PlanGoalsCard card={card} summary={summary} />;
    case "last_workout":
      return <LastWorkoutCard card={card} summary={summary} />;
    default:
      return null;
  }
}
