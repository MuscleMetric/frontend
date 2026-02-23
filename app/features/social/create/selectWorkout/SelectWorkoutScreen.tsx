// app/features/social/create/selectWorkout/SelectWorkoutScreen.tsx

import React, { useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  TouchableOpacity,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "@/lib/useAppTheme";
import { Icon } from "@/ui/icons/Icon";

import type { WorkoutSelection } from "../state/createPostTypes";
import PrimaryActionButton from "../shared/PrimaryActionButton";
import WorkoutRow from "./WorkoutRow";
import { useWorkoutSearch } from "./useWorkoutSearch";

type Props = {
  workouts: WorkoutSelection[];
  selectedWorkoutId: string | null;
  onSelect: (workout: WorkoutSelection) => void;

  onBack: () => void;
  onNext: () => void;

  query: string;
  onChangeQuery: (q: string) => void;

  loading?: boolean;
};

export default function SelectWorkoutScreen(props: Props) {
  const { colors, typography, layout } = useAppTheme();
  const insets = useSafeAreaInsets();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        screen: {
          flex: 1,
          backgroundColor: colors.bg,
          paddingTop: insets.top + 8,
        },
        header: {
          paddingHorizontal: 16,
          marginBottom: 12,
        },
        topRow: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 10,
        },
        backBtn: {
          width: 42,
          height: 42,
          borderRadius: 14,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          alignItems: "center",
          justifyContent: "center",
        },
        titleWrap: {
          flex: 1,
          marginLeft: 12,
        },
        title: {
          fontSize: typography.size.h2,
          fontWeight: "800",
          color: colors.text,
        },
        subtitle: {
          marginTop: 2,
          fontSize: typography.size.meta,
          color: colors.textMuted,
        },
        searchWrap: {
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 16,
          paddingHorizontal: 12,
          height: 46,
          gap: 8,
        },
        searchInput: {
          flex: 1,
          fontSize: typography.size.body,
          color: colors.text,
        },
        list: {
          paddingHorizontal: 16,
          paddingBottom: 10,
        },
        footer: {
          paddingHorizontal: 16,
          paddingTop: 10,
          paddingBottom: Math.max(16, insets.bottom + 12),
          borderTopWidth: 1,
          borderTopColor: colors.border,
          backgroundColor: colors.bg,
        },
        empty: {
          paddingHorizontal: 16,
          paddingVertical: 24,
          alignItems: "center",
        },
        emptyTitle: {
          fontSize: typography.size.body,
          fontWeight: "700",
          color: colors.text,
          marginBottom: 6,
        },
        emptySub: {
          fontSize: typography.size.meta,
          color: colors.textMuted,
          textAlign: "center",
        },
      }),
    [colors, typography, layout, insets.top, insets.bottom]
  );

  const filtered = useWorkoutSearch(props.workouts, props.query);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.topRow}>
          <TouchableOpacity style={styles.backBtn} onPress={props.onBack} activeOpacity={0.85}>
            <Icon name={"chevron-left" as any} size={18} color={colors.text} />
          </TouchableOpacity>

          <View style={styles.titleWrap}>
            <Text style={styles.title}>Select Workout</Text>
            <Text style={styles.subtitle}>Choose a completed session to share</Text>
          </View>

          {/* spacer to balance header */}
          <View style={{ width: 42 }} />
        </View>

        <View style={styles.searchWrap}>
          <Icon name={"search" as any} size={16} color={colors.textMuted} />
          <TextInput
            value={props.query}
            onChangeText={props.onChangeQuery}
            placeholder="Search workouts"
            placeholderTextColor={colors.textMuted}
            style={styles.searchInput}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.workoutHistoryId}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        renderItem={({ item }) => (
          <WorkoutRow
            workout={item}
            selected={props.selectedWorkoutId === item.workoutHistoryId}
            onPress={() => props.onSelect(item)}
          />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No workouts found</Text>
            <Text style={styles.emptySub}>
              Try a different search, or complete a workout first.
            </Text>
          </View>
        }
      />

      <View style={styles.footer}>
        <PrimaryActionButton
          label="Next"
          onPress={props.onNext}
          disabled={!props.selectedWorkoutId || props.loading}
          loading={props.loading}
        />
      </View>
    </View>
  );
}