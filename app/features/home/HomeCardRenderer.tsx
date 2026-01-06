import React from "react";
import { HeroCard } from "./cards/HeroCard";
import { WeeklyGoalCard } from "./cards/WeeklyGoalCard";
import { LatestPRCard } from "./cards/LatestPRCard";
import { StreakCard } from "./cards/StreakCard";
import { VolumeTrendCard } from "./cards/VolumeTrendCard";
import { PlanGoalsCard } from "./cards/PlanGoalsCard";
import { LastWorkoutCard } from "./cards/LastWorkoutCard";

export function HomeCardRenderer({ card }: { card: any; summary: any }) {
  switch (card?.type) {
    case "hero":
      return <HeroCard card={card} />;
    case "weekly_goal":
      return <WeeklyGoalCard card={card} />;
    case "latest_pr":
      return <LatestPRCard card={card} />;
    case "streak":
      return <StreakCard card={card} />;
    case "volume_trend":
      return <VolumeTrendCard card={card} />;
    case "plan_goals":
      return <PlanGoalsCard card={card} />;
    case "last_workout":
      return <LastWorkoutCard card={card} />;
    default:
      return null;
  }
}
