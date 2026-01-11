// app/features/home/ui/cards/StarterTemplatesCard.tsx
import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable, FlatList } from "react-native";
import { useAppTheme } from "../../../../../lib/useAppTheme";
import { Card, Pill, WorkoutCover } from "@/ui";
import { StarterTemplatePreviewModal } from "../modals/StarterTemplatePreviewModal";

type StarterTemplateItem = {
  template_workout_id: string;
  title: string;
  subtitle?: string | null;
  badge?: string | null;

  workoutImageKey?: string | null; // ✅ from backend: workout_image_key
  duration_min?: number | null;
  exercise_count?: number | null;
};

function normalizeItems(card: any): StarterTemplateItem[] {
  const raw = Array.isArray(card?.items) ? card.items : [];

  return raw
    .map((it: any) => {
      const templateId =
        it?.template_workout_id ??
        it?.workout_id ??
        it?.id ??
        it?.template_id ??
        null;

      if (!templateId) return null;

      return {
        template_workout_id: String(templateId),
        title: String(it?.title ?? it?.name ?? "Starter workout"),
        subtitle: it?.subtitle != null ? String(it.subtitle) : null,
        badge: it?.badge != null ? String(it.badge) : null,

        // ✅ IMPORTANT: your backend must return workout_image_key
        workoutImageKey: it?.workout_image_key != null ? String(it.workout_image_key) : null,

        duration_min:
          it?.duration_min != null
            ? Number(it.duration_min)
            : it?.duration_minutes != null
            ? Number(it.duration_minutes)
            : null,

        exercise_count: it?.exercise_count != null ? Number(it.exercise_count) : null,
      } as StarterTemplateItem;
    })
    .filter(Boolean) as StarterTemplateItem[];
}

function fmtMin(m?: number | null) {
  if (!m || m <= 0) return null;
  return `${Math.round(m)}m`;
}

export function StarterTemplatesCard({ card }: { card: any; summary?: any }) {
  const { colors, typography, layout } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors, typography, layout), [colors, typography, layout]);

  const items = useMemo(() => normalizeItems(card), [card]);
  if (!items.length) return null;

  const [open, setOpen] = useState(false);
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
  const [activeTitle, setActiveTitle] = useState<string>("");
  const [activeTemplateKey, setActiveTemplateKey] = useState<string | null>(null); // ✅ for modal header image

  function openTemplate(it: StarterTemplateItem) {
    setActiveTemplateId(it.template_workout_id);
    setActiveTitle(it.title);

    // ✅ Use returned workout_image_key if present; otherwise fallback
    setActiveTemplateKey(it.workoutImageKey ?? "full_body");

    setOpen(true);
  }

  return (
    <>
      <Card style={styles.card}>
        <View style={{ gap: layout.space.md }}>
          {/* Header like reference (no view all) */}
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>Starter workouts</Text>
              <Text style={styles.headerSub} numberOfLines={2}>
                Pick one to preview. Start it once and we’ll add it to your library.
              </Text>
            </View>

            <Pill label="NEW" tone="neutral" />
          </View>

          <FlatList
            data={items}
            keyExtractor={(it) => it.template_workout_id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => {
              const duration = fmtMin(item.duration_min);
              const exCount = item.exercise_count != null ? `${item.exercise_count} exercises` : null;

              return (
                <Pressable
                  onPress={() => openTemplate(item)}
                  style={({ pressed }) => [styles.tile, pressed ? { opacity: 0.92 } : null]}
                >
                  <WorkoutCover
                    imageKey={item.workoutImageKey ?? "full_body"}
                    height={140}
                    radius={layout.radius.xl}
                    title={null}
                    subtitle={null}
                    badge={item.badge ? <Pill label={item.badge} tone="neutral" /> : null}
                    badgePosition="topLeft"
                  />

                  <View style={styles.body}>
                    <Text style={styles.tileTitle} numberOfLines={1}>
                      {item.title}
                    </Text>

                    {!!item.subtitle ? (
                      <Text style={styles.tileSub} numberOfLines={2}>
                        {item.subtitle}
                      </Text>
                    ) : (
                      <Text style={styles.tileSub} numberOfLines={2}>
                        Perfect for getting started. Focus on form and build momentum.
                      </Text>
                    )}

                    <View style={styles.metaRow}>
                      {duration ? (
                        <View style={styles.chip}>
                          <Text style={styles.chipText}>{duration}</Text>
                        </View>
                      ) : null}

                      {exCount ? (
                        <View style={styles.chip}>
                          <Text style={styles.chipText}>{exCount}</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                </Pressable>
              );
            }}
          />

          <Text style={styles.noteText}>
            Tip: don’t overthink it — log your first 1–2 workouts and build momentum.
          </Text>
        </View>
      </Card>

      <StarterTemplatePreviewModal
        visible={open}
        templateWorkoutId={activeTemplateId}
        title={activeTitle}
        imageKey={activeTemplateKey} // ✅ now defined + set
        onClose={() => setOpen(false)}
      />
    </>
  );
}

const makeStyles = (colors: any, typography: any, layout: any) =>
  StyleSheet.create({
    card: {
      padding: layout.space.lg,
      borderRadius: layout.radius.xl,
    },

    headerRow: {
      flexDirection: "row",
      gap: layout.space.md,
      alignItems: "flex-start",
      justifyContent: "space-between",
    },

    headerTitle: {
      fontFamily: typography.fontFamily.bold,
      fontSize: typography.size.h2,
      color: colors.text,
      letterSpacing: -0.3,
    },

    headerSub: {
      marginTop: 6,
      fontFamily: typography.fontFamily.medium,
      fontSize: typography.size.sub,
      color: colors.textMuted,
    },

    listContent: {
      gap: layout.space.md,
      paddingTop: 6,
      paddingBottom: 4,
    },

    tile: {
      width: 260,
      borderRadius: layout.radius.xl,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: "hidden",
    },

    body: {
      padding: layout.space.md,
      gap: 8,
    },

    tileTitle: {
      fontFamily: typography.fontFamily.bold,
      fontSize: typography.size.h2,
      color: colors.text,
      letterSpacing: -0.3,
    },

    tileSub: {
      fontFamily: typography.fontFamily.medium,
      fontSize: typography.size.sub,
      color: colors.textMuted,
      lineHeight: typography.lineHeight.body,
    },

    metaRow: {
      marginTop: 4,
      flexDirection: "row",
      gap: 10,
      alignItems: "center",
    },

    chip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: colors.trackBg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.trackBorder,
    },

    chipText: {
      fontFamily: typography.fontFamily.semibold,
      fontSize: typography.size.meta,
      color: colors.textMuted,
      letterSpacing: 0.1,
    },

    noteText: {
      marginTop: 2,
      fontFamily: typography.fontFamily.medium,
      fontSize: typography.size.meta,
      color: colors.textMuted,
    },
  });
