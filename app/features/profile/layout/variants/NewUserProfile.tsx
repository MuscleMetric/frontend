import React, { useState } from "react";
import type { ProfileOverview } from "../../data/profileTypes";

import ProfileHeaderCard from "../../ui/ProfileHeaderCard";
import ProfileProCard from "../../ui/ProfileProCard";
import OnboardingCard from "../../ui/OnboardingCard";
import ActivityCard from "../../ui/ActivityCard";
import FavouriteAchievementsCard from "../../ui/FavouriteAchievementsCard";
import RecentHistoryCard from "../../ui/RecentHistoryCard";
import { useAppTheme } from "@/lib/useAppTheme";
import { View } from "react-native";
import FeaturePaywallModal from "@/app/features/paywall/components/FeaturePaywallModal";
import { useAuth } from "@/lib/authContext";

export default function NewUserProfile({ data }: { data: ProfileOverview }) {
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

      <OnboardingCard data={data} />
      <ActivityCard data={data} showPlanned={false} />
      <FavouriteAchievementsCard data={data} />
      <RecentHistoryCard data={data} />
    </View>
  );
}
