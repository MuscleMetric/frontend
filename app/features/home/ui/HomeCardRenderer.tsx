import React from "react";
import { HeroCard } from "./cards/HeroCard";
import { WeeklyGoalCard } from "./cards/WeeklyGoalCard";
import { LatestPRCard } from "./cards/LatestPRCard";
import { StreakCard } from "./cards/StreakCard";
import { VolumeTrendCard } from "./cards/VolumeTrendCard";
import { PlanGoalsCard } from "./cards/PlanGoalsCard";
import { LastWorkoutCard } from "./cards/LastWorkoutCard";
import { UnlockPreviewCard } from "./cards/UnlockPreviewCard";
import { StarterTemplatesCard } from "./cards/StarterTemplatesCard";

export function HomeCardRenderer({
  card,
  summary,
}: {
  card: any;
  summary: any;
}) {
  if (!card?.type) return null;

  switch (card.type) {
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
    case "unlock_preview":
      return <UnlockPreviewCard card={card} summary={summary} />;
    case "starter_templates":
      return <StarterTemplatesCard card={card} summary={summary} />;

    default:
      return null;
  }
}
