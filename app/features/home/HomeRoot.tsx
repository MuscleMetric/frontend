//app/features/home/HomeRoot.tsx
import React, { useMemo } from "react";
import { HomeNewUser } from "./layouts/HomeNewUser";
import { HomeExperiencedNoPlan } from "./layouts/HomeExperiencedNoPlan";
import { HomeExperiencedPlan } from "./layouts/HomeExperiencedPlan";

type Props = { summary: any; userId: string };

/**
 * HomeRoot
 * - Server owns summary.home_variant (frozen rules).
 * - UI owns layout composition per variant (locked designs).
 * - Quote must always be visible and is rendered inside each layout
 *   directly under the primary action.
 */
export function HomeRoot({ summary, userId }: Props) {
  const variant = useMemo(() => summary?.home_variant ?? "new_user", [summary]);

  switch (variant) {
    case "experienced_plan":
      return <HomeExperiencedPlan summary={summary} userId={userId} />;

    case "experienced_no_plan":
      return <HomeExperiencedNoPlan summary={summary} userId={userId} />;

    case "new_user":
    default:
      return <HomeNewUser summary={summary} userId={userId} />;
  }
}
