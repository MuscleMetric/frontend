// app/features/social/create/editPrPost/EditPrPostScreen.tsx

import React, { useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  FlatList,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "@/lib/useAppTheme";
import { Icon } from "@/ui/icons/Icon";

import type { PrSelection, PrPostDraft } from "../state/createPostTypes";
import AudiencePill from "../shared/AudiencePill";
import PrimaryActionButton from "../shared/PrimaryActionButton";
import PrPostPreviewCard from "./PrPostPreviewCard";
import PrCaptionBox from "./PrCaptionBox";

type PrExerciseItem = {
  exercise_id: string;
  exercise_name: string;
  best_weight: number;
  best_reps: number;
  estimated_1rm: number | null;
  best_achieved_at: string;
  workout_history_id: string | null;
  previous_best_weight: number | null;
  previous_best_reps: number | null;
  delta_weight: number | null;
};

type Mode = "select" | "compose";

type Props = {
  mode: Mode;

  // compose state
  pr: PrSelection | null;
  draft: PrPostDraft;

  // selection state
  query: string;
  onChangeQuery: (value: string) => void;

  exercises: PrExerciseItem[];

  selectedExerciseId: string | null;

  onSelectExercise: (exercise: PrExerciseItem) => void;
  onContinueFromSelection: () => void;

  loadingExercises?: boolean;

  onBack: () => void;

  onChangeAudience: (audience: PrPostDraft["audience"]) => void;
  onChangeCaption: (caption: string) => void;

  onPost: () => void;
  posting?: boolean;
};

function formatWeight(weight: number) {
  return Number.isInteger(weight) ? String(weight) : weight.toFixed(1);
}

function formatE1RM(value: number | null | undefined) {
  if (value == null) return "--";
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export default function EditPrPostScreen(props: Props) {
  const { colors, typography } = useAppTheme();
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
          marginBottom: 10,
        },
        topRow: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
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
          fontWeight: "900",
          color: colors.text,
        },
        subtitle: {
          marginTop: 2,
          fontSize: typography.size.meta,
          color: colors.textMuted,
          fontWeight: "600",
        },
        content: {
          paddingHorizontal: 16,
          paddingBottom: 12,
        },
        sectionLabel: {
          marginTop: 14,
          marginBottom: 8,
          fontSize: typography.size.meta,
          color: colors.textMuted,
          fontWeight: "700",
        },
        footer: {
          paddingHorizontal: 16,
          paddingTop: 10,
          paddingBottom: Math.max(16, insets.bottom + 12),
          borderTopWidth: 1,
          borderTopColor: colors.border,
          backgroundColor: colors.bg,
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

        card: {
          borderRadius: 18,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          padding: 14,
        },
        selectedCard: {
          borderColor: colors.primary,
        },
        cardTitle: {
          color: colors.text,
          fontSize: typography.size.body,
          fontWeight: "800",
        },
        cardSub: {
          marginTop: 4,
          color: colors.textMuted,
          fontSize: typography.size.meta,
          fontWeight: "600",
        },
        cardMetaRow: {
          marginTop: 10,
          flexDirection: "row",
          gap: 8,
          flexWrap: "wrap",
        },
        pill: {
          borderRadius: 999,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.bg,
          paddingHorizontal: 10,
          paddingVertical: 6,
        },
        pillText: {
          color: colors.textMuted,
          fontSize: typography.size.meta,
          fontWeight: "700",
        },

        emptyCard: {
          borderRadius: 18,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          padding: 18,
          alignItems: "center",
        },
        emptyTitle: {
          color: colors.text,
          fontSize: typography.size.body,
          fontWeight: "800",
          marginBottom: 6,
        },
        emptySub: {
          color: colors.textMuted,
          fontSize: typography.size.meta,
          textAlign: "center",
        },
      }),
    [colors, typography, insets.top, insets.bottom]
  );

  const renderSelectionState = () => {
    return (
      <>
        <View style={styles.header}>
          <View style={styles.topRow}>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={props.onBack}
              activeOpacity={0.85}
            >
              <Icon name={"chevron-back" as any} size={18} color={colors.text} />
            </TouchableOpacity>

            <View style={styles.titleWrap}>
              <Text style={styles.title}>Select PR</Text>
              <Text style={styles.subtitle}>
                Choose the exercise whose current best lift you want to share
              </Text>
            </View>

            <View style={{ width: 42 }} />
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.searchWrap}>
            <Icon name={"search" as any} size={16} color={colors.textMuted} />
            <TextInput
              value={props.query}
              onChangeText={props.onChangeQuery}
              placeholder="Search exercises"
              placeholderTextColor={colors.textMuted}
              style={styles.searchInput}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
          </View>

          <Text style={styles.sectionLabel}>Exercises</Text>

          {props.loadingExercises ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>Loading exercises</Text>
              <Text style={styles.emptySub}>Getting your best lifts…</Text>
            </View>
          ) : props.exercises.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No exercises found</Text>
              <Text style={styles.emptySub}>
                Complete some weighted sets first, or try a different search.
              </Text>
            </View>
          ) : (
            <FlatList
              data={props.exercises}
              keyExtractor={(item) => item.exercise_id}
              scrollEnabled={false}
              ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
              renderItem={({ item }) => {
                const selected = props.selectedExerciseId === item.exercise_id;
                return (
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => props.onSelectExercise(item)}
                    style={[styles.card, selected && styles.selectedCard]}
                  >
                    <Text style={styles.cardTitle}>{item.exercise_name}</Text>
                    <Text style={styles.cardSub}>
                      Best lift: {formatWeight(item.best_weight)}kg × {item.best_reps}
                    </Text>

                    <View style={styles.cardMetaRow}>
                      <View style={styles.pill}>
                        <Text style={styles.pillText}>
                          e1RM {formatE1RM(item.estimated_1rm)}kg
                        </Text>
                      </View>

                      {item.delta_weight != null ? (
                        <View style={styles.pill}>
                          <Text style={styles.pillText}>
                            +{formatWeight(item.delta_weight)}kg
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </ScrollView>

        <View style={styles.footer}>
          <PrimaryActionButton
            label="Next"
            onPress={props.onContinueFromSelection}
            disabled={!props.selectedExerciseId}
            loading={props.loadingExercises}
          />
        </View>
      </>
    );
  };

  const renderComposeState = () => {
    if (!props.pr) {
      return (
        <View style={styles.screen}>
          <View style={styles.header}>
            <View style={styles.topRow}>
              <TouchableOpacity
                style={styles.backBtn}
                onPress={props.onBack}
                activeOpacity={0.85}
              >
                <Icon name={"chevron-back" as any} size={18} color={colors.text} />
              </TouchableOpacity>
              <View style={styles.titleWrap}>
                <Text style={styles.title}>Create PR Post</Text>
                <Text style={styles.subtitle}>No PR selected</Text>
              </View>
              <View style={{ width: 42 }} />
            </View>
          </View>
        </View>
      );
    }

    return (
      <>
        <View style={styles.header}>
          <View style={styles.topRow}>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={props.onBack}
              activeOpacity={0.85}
            >
              <Icon name={"chevron-back" as any} size={18} color={colors.text} />
            </TouchableOpacity>

            <View style={styles.titleWrap}>
              <Text style={styles.title}>New PR Post</Text>
              <Text style={styles.subtitle}>Share your achievement</Text>
            </View>

            <View style={{ width: 42 }} />
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <PrPostPreviewCard pr={props.pr} caption={props.draft.caption} />

          <Text style={styles.sectionLabel}>Audience</Text>
          <AudiencePill
            value={props.draft.audience}
            onChange={props.onChangeAudience}
          />

          <PrCaptionBox
            value={props.draft.caption}
            onChange={props.onChangeCaption}
          />
        </ScrollView>

        <View style={styles.footer}>
          <PrimaryActionButton
            label="Share PR"
            onPress={props.onPost}
            loading={props.posting}
            disabled={props.posting}
          />
        </View>
      </>
    );
  };

  return (
    <View style={styles.screen}>
      {props.mode === "select" ? renderSelectionState() : renderComposeState()}
    </View>
  );
}