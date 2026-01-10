// app/features/home/ui/cards/StarterTemplatesCard.tsx
import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable, FlatList } from "react-native";
import { useAppTheme } from "../../../../../lib/useAppTheme";
import { Card, Pill } from "@/ui";
import { StarterTemplatePreviewModal } from "../modals/StarterTemplatePreviewModal";

type StarterTemplateItem = {
  template_workout_id: string;
  title: string;
  subtitle?: string | null;
  badge?: string | null;
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
      } as StarterTemplateItem;
    })
    .filter(Boolean) as StarterTemplateItem[];
}

export function StarterTemplatesCard({ card }: { card: any; summary?: any }) {
  const { colors, typography, layout } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors, typography, layout), [colors, typography, layout]);

  const items = useMemo(() => normalizeItems(card), [card]);

  // If backend decided this section should disappear, it should return 0 items.
  if (!items.length) return null;

  const [open, setOpen] = useState(false);
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
  const [activeTitle, setActiveTitle] = useState<string>("");

  function openTemplate(it: StarterTemplateItem) {
    setActiveTemplateId(it.template_workout_id);
    setActiveTitle(it.title);
    setOpen(true);
  }

  return (
    <>
      <Card style={styles.card}>
        <View style={{ gap: layout.space.md }}>
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>Starter workouts</Text>
              <Text style={styles.headerSub} numberOfLines={2}>
                Pick one to preview. Start now to add it to your library automatically.
              </Text>
            </View>

            <Pill label="NEW" tone="primary" />
          </View>

          <FlatList
            data={items}
            keyExtractor={(it) => it.template_workout_id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: layout.space.sm }}
            renderItem={({ item }) => {
              return (
                <Pressable
                  onPress={() => openTemplate(item)}
                  style={({ pressed }) => [styles.tile, pressed ? { opacity: 0.85 } : null]}
                >
                  {!!item.badge ? (
                    <View style={{ alignSelf: "flex-start" }}>
                      <Pill label={item.badge} tone="neutral" />
                    </View>
                  ) : null}

                  <Text style={styles.tileTitle} numberOfLines={2}>
                    {item.title}
                  </Text>

                  {!!item.subtitle ? (
                    <Text style={styles.tileSub} numberOfLines={2}>
                      {item.subtitle}
                    </Text>
                  ) : (
                    <Text style={styles.tileSub} numberOfLines={2}>
                      Preview exercises → Start now
                    </Text>
                  )}
                </Pressable>
              );
            }}
          />

          <View style={styles.noteRow}>
            <Text style={styles.noteText}>
              Tip: don’t overthink it — the goal is to log your first 1–2 workouts and build momentum.
            </Text>
          </View>
        </View>
      </Card>

      <StarterTemplatePreviewModal
        visible={open}
        templateWorkoutId={activeTemplateId}
        title={activeTitle}
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
      marginTop: 4,
      fontFamily: typography.fontFamily.medium,
      fontSize: typography.size.sub,
      color: colors.textMuted,
    },
    tile: {
      width: 190,
      minHeight: 120,
      borderRadius: layout.radius.lg,
      padding: layout.space.md,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      gap: layout.space.sm,
    },
    tileTitle: {
      fontFamily: typography.fontFamily.bold,
      fontSize: typography.size.body,
      color: colors.text,
      letterSpacing: -0.2,
    },
    tileSub: {
      fontFamily: typography.fontFamily.medium,
      fontSize: typography.size.sub,
      color: colors.textMuted,
    },
    noteRow: {
      marginTop: layout.space.xs,
    },
    noteText: {
      fontFamily: typography.fontFamily.medium,
      fontSize: typography.size.meta,
      color: colors.textMuted,
    },
  });
