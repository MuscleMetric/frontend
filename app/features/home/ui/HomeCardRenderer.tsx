import React, { useState } from "react";
import { HeroCard } from "./cards/HeroCard";
import { WeeklyGoalCard } from "./cards/WeeklyGoalCard";
import { LatestPRCard } from "./cards/LatestPRCard";
import { StreakCard } from "./cards/StreakCard";
import { VolumeTrendCard } from "./cards/VolumeTrendCard";
import { PlanGoalsCard } from "./cards/PlanGoalsCard";
import { LastWorkoutCard } from "./cards/LastWorkoutCard";
import { UnlockPreviewCard } from "./cards/UnlockPreviewCard";
import { StarterTemplatesCard } from "./cards/StarterTemplatesCard";
import { useAuth } from "@/lib/authContext";
import { router } from "expo-router";
import FeaturePaywallModal from "@/app/features/paywall/components/FeaturePaywallModal";

export function HomeCardRenderer({
  card,
  summary,
}: {
  card: any;
  summary: any;
}) {
  const [paywallOpen, setPaywallOpen] = useState(false);
  const { capabilities } = useAuth();

  const handleOpenDeepAnalytics = (exerciseId: string) => {
    if (capabilities.canViewDeepAnalytics) {
      router.push({
        pathname: "/features/progress/screens/deep-analytics",
        params: { exerciseId },
      });
      return;
    }

    setPaywallOpen(true);
  };

  if (!card?.type) return null;

  let content: React.ReactNode = null;

  switch (card.type) {
    case "hero":
      content = <HeroCard card={card} summary={summary} />;
      break;

    case "weekly_goal":
      content = <WeeklyGoalCard card={card} summary={summary} />;
      break;

    case "latest_pr":
      content = (
        <LatestPRCard
          card={card}
          summary={summary}
          onOpenDeepAnalytics={handleOpenDeepAnalytics}
        />
      );
      break;

    case "streak":
      content = <StreakCard card={card} summary={summary} />;
      break;

    case "volume_trend":
      content = <VolumeTrendCard card={card} summary={summary} />;
      break;

    case "plan_goals":
      content = <PlanGoalsCard card={card} summary={summary} />;
      break;

    case "last_workout":
      content = <LastWorkoutCard card={card} summary={summary} />;
      break;

    case "unlock_preview":
      content = <UnlockPreviewCard card={card} summary={summary} />;
      break;

    case "starter_templates":
      content = <StarterTemplatesCard card={card} summary={summary} />;
      break;

    default:
      return null;
  }

  return (
    <>
      {content}

      <FeaturePaywallModal
        visible={paywallOpen}
        reason="deep_analytics"
        onClose={() => setPaywallOpen(false)}
      />
    </>
  );
}
