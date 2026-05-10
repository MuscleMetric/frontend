import React, { useState } from "react";
import type { ProfileOverview } from "../../data/profileTypes";

import ProfileHeaderCard from "../../ui/ProfileHeaderCard";
import ActivePlanCard from "../../ui/ActivePlanCard";
import ActivityCard from "../../ui/ActivityCard";
import FavouriteAchievementsCard from "../../ui/FavouriteAchievementsCard";
import RecentHistoryCard from "../../ui/RecentHistoryCard";
import RecentPostsCard from "../../ui/RecentPostsCard";
import RecentPlansCard from "../../ui/RecentPlansCard";
import { useAppTheme } from "@/lib/useAppTheme";
import { View } from "react-native";
import ProfileProCard from "../../ui/ProfileProCard";
import FeaturePaywallModal from "@/app/features/paywall/components/FeaturePaywallModal";
import { useAuth } from "@/lib/authContext";

export default function WithPlanProfile({ data }: { data: ProfileOverview }) {
  const { layout } = useAppTheme();
  const { entitlements, entitlementsLoading } = useAuth();

  const [paywallOpen, setPaywallOpen] = useState(false);

  const showProCard =
    !entitlementsLoading && (!entitlements || entitlements.tier === "free");

  return (
    <View style={{ gap: layout.space.md }}>
      <ProfileHeaderCard data={data} />

      {showProCard ? (
        <ProfileProCard onPress={() => setPaywallOpen(true)} />
      ) : null}

      <FeaturePaywallModal
        visible={paywallOpen}
        reason="deep_analytics"
        onClose={() => setPaywallOpen(false)}
      />

      <ActivePlanCard data={data} />
      <ActivityCard data={data} showPlanned={true} />
      <FavouriteAchievementsCard data={data} />
      <RecentHistoryCard data={data} />
      <RecentPostsCard data={data} />
      <RecentPlansCard data={data} />
    </View>
  );
}
