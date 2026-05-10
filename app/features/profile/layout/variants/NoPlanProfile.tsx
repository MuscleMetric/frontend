import React, { useState } from "react";
import type { ProfileOverview } from "../../data/profileTypes";

import ProfileHeaderCard from "../../ui/ProfileHeaderCard";
import ChallengeBanner from "../../ui/ChallengeBanner";
import ActivityCard from "../../ui/ActivityCard";
import FavouriteAchievementsCard from "../../ui/FavouriteAchievementsCard";
import RecentPlansCard from "../../ui/RecentPlansCard";
import RecentHistoryCard from "../../ui/RecentHistoryCard";
import { useAppTheme } from "@/lib/useAppTheme";
import { View } from "react-native";
import ProfileProCard from "../../ui/ProfileProCard";
import FeaturePaywallModal from "@/app/features/paywall/components/FeaturePaywallModal";
import { useAuth } from "@/lib/authContext";

export default function NoPlanProfile({ data }: { data: ProfileOverview }) {
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

      <ChallengeBanner />
      <ActivityCard data={data} showPlanned={false} />
      <FavouriteAchievementsCard data={data} />
      <RecentPlansCard data={data} />
      <RecentHistoryCard data={data} />
    </View>
  );
}
