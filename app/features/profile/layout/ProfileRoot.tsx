import React from "react";
import { ScrollView, StatusBar, RefreshControl, View } from "react-native";

import { useAppTheme } from "@/lib/useAppTheme";
import { useProfileOverview } from "../data/useProfileOverview";

import NewUserProfile from "./variants/NewUserProfile";
import NoPlanProfile from "./variants/NoPlanProfile";
import WithPlanProfile from "./variants/WithPlanProfile";

import { AuthRequiredState, LoadingScreen, ErrorState } from "@/ui";

export default function ProfileRoot() {
  const { colors, scheme, layout } = useAppTheme();
  const dark = scheme === "dark";

  const { userId, data, loading, error, refetch } = useProfileOverview();

  if (!userId) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <StatusBar
          barStyle={dark ? "light-content" : "dark-content"}
          backgroundColor={colors.bg}
        />
        <AuthRequiredState />
      </View>
    );
  }

  if (loading && !data) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <StatusBar
          barStyle={dark ? "light-content" : "dark-content"}
          backgroundColor={colors.bg}
        />
        <LoadingScreen />
      </View>
    );
  }

  if (error && !data) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <StatusBar
          barStyle={dark ? "light-content" : "dark-content"}
          backgroundColor={colors.bg}
        />
        <ErrorState title="Couldn’t load profile" message={error} onRetry={refetch} />
      </View>
    );
  }

  const variant = data?.profile_variant ?? "new_user";

  return (
    <>
      <StatusBar
        barStyle={dark ? "light-content" : "dark-content"}
        backgroundColor={colors.bg}
      />

      <ScrollView
        style={{ flex: 1, backgroundColor: colors.bg }}
        contentContainerStyle={{
          padding: layout.space.lg,
          paddingBottom: layout.space.xxl,
        }}
        refreshControl={
          <RefreshControl
            refreshing={!!loading}
            onRefresh={refetch}
            tintColor={colors.text}
          />
        }
      >
        {variant === "new_user" ? (
          <NewUserProfile data={data!} />
        ) : variant === "experienced_with_plan" ? (
          <WithPlanProfile data={data!} />
        ) : (
          <NoPlanProfile data={data!} />
        )}
      </ScrollView>
    </>
  );
}
