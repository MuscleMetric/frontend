import React from "react";
import type { ProfileOverview } from "../../data/profileTypes";

import ProfileHeaderCard from "../../ui/ProfileHeaderCard";
import OnboardingCard from "../../ui/OnboardingCard";
import ActivityCard from "../../ui/ActivityCard";
import FavouriteAchievementsCard from "../../ui/FavouriteAchievementsCard";
import RecentHistoryCard from "../../ui/RecentHistoryCard";
import SettingsSection from "../../ui/SettingsSection";

export default function NewUserProfile({ data }: { data: ProfileOverview }) {
  return (
    <>
      <ProfileHeaderCard data={data} />
      <OnboardingCard data={data} />
      <ActivityCard data={data} showPlanned={false} />
      <FavouriteAchievementsCard data={data} />
      <RecentHistoryCard data={data} />
      <SettingsSection />
    </>
  );
}
