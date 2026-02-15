import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  TextInput,
} from "react-native";
import { router } from "expo-router";
import { useAppTheme } from "@/lib/useAppTheme";
import { supabase } from "@/lib/supabase";
import { SafeAreaView } from "react-native-safe-area-context";

type PrPickerRow = {
  exercise_id: string;
  exercise_name: string | null;
  last_done_at: string | null;
  recent_best_weight: number | string | null;
  prev_best_weight: number | string | null;
  pr_delta: number | string | null;
  is_pr: boolean | null;
};

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "—";
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function fmtNum(n: number | string | null | undefined) {
  if (n == null) return "—";
  const v = typeof n === "string" ? Number(n) : n;
  if (!Number.isFinite(v)) return "—";
  // keep it simple; we can respect user units later
  return v % 1 === 0 ? String(v) : v.toFixed(1);
}

export default function CreatePrPostScreen() {
  const { colors, typography, layout } = useAppTheme();

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<PrPickerRow[]>([]);
  const [selected, setSelected] = useState<PrPickerRow | null>(null);

  const [visibility, setVisibility] = useState<
    "public" | "followers" | "private"
  >("followers");

  const [caption, setCaption] = useState("PR check ✅ moved fast today. Onwards.");
  const [err, setErr] = useState<string | null>(null);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        screen: {
          flex: 1,
          backgroundColor: colors.bg,
          padding: layout.space.lg,
          gap: layout.space.md,
        },
        title: {
          color: colors.text,
          fontFamily: typography.fontFamily.bold,
          fontSize: typography.size.h1,
        },
        sub: {
          color: colors.textMuted,
          fontFamily: typography.fontFamily.regular,
          fontSize: typography.size.sub,
        },
        card: {
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          borderRadius: layout.radius.lg,
          padding: layout.space.lg,
          gap: layout.space.md,
          flex: 1,
        },
        pillRow: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
        pill: {
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.bg,
        },
        pillOn: {
          backgroundColor: colors.cardPressed,
          borderColor: colors.primary,
        },
        pillText: {
          color: colors.text,
          fontFamily: typography.fontFamily.semibold,
          fontSize: typography.size.meta,
        },
        input: {
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.bg,
          borderRadius: layout.radius.md,
          padding: 12,
          color: colors.text,
          fontFamily: typography.fontFamily.regular,
          fontSize: typography.size.body,
        },

        row: {
          paddingVertical: 12,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        rowOn: {
          backgroundColor: colors.cardPressed,
          borderRadius: layout.radius.md,
          paddingHorizontal: 10,
        },

        rowTop: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
        },
        name: {
          flex: 1,
          color: colors.text,
          fontFamily: typography.fontFamily.medium,
          fontSize: typography.size.body,
        },

        badge: {
          paddingHorizontal: 10,
          paddingVertical: 6,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.bg,
        },
        badgeText: {
          color: colors.textMuted,
          fontFamily: typography.fontFamily.semibold,
          fontSize: typography.size.meta,
        },

        metaRow: {
          marginTop: 6,
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 10,
        },
        meta: {
          color: colors.textMuted,
          fontFamily: typography.fontFamily.regular,
          fontSize: typography.size.meta,
          lineHeight: typography.lineHeight.meta,
        },

        btn: {
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.primary,
          borderRadius: layout.radius.md,
          paddingVertical: 12,
          alignItems: "center",
        },
        btnText: {
          color: colors.onPrimary,
          fontFamily: typography.fontFamily.semibold,
          fontSize: typography.size.body,
        },
        ghost: {
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          borderRadius: layout.radius.md,
          paddingVertical: 12,
          alignItems: "center",
        },
        ghostText: {
          color: colors.text,
          fontFamily: typography.fontFamily.semibold,
          fontSize: typography.size.body,
        },
        error: {
          color: colors.danger,
          fontFamily: typography.fontFamily.medium,
          fontSize: typography.size.sub,
        },
      }),
    [colors, typography, layout]
  );

  const loadPicker = useCallback(async () => {
    setLoading(true);
    setErr(null);

    const res = await supabase.rpc("get_pr_exercise_picker_v1", { p_limit: 50 });

    if (res.error) {
      console.log("get_pr_exercise_picker_v1 error:", res.error);
      setRows([]);
      setErr(res.error.message ?? "Failed to load PR exercises");
      setLoading(false);
      return;
    }

    const data = (res.data ?? []) as PrPickerRow[];
    setRows(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadPicker();
  }, [loadPicker]);

  const goReview = () => {
    if (!selected?.exercise_id) return;

    const exName = selected.exercise_name ?? "Exercise";

    const captionWithName = caption.includes("✅")
      ? caption.replace("✅", `✅ ${exName}`)
      : `✅ ${exName} — ${caption}`;

    const draft = {
      post_type: "pr" as const,
      visibility,
      caption: captionWithName.trim(),
      workout_history_id: null,
      exercise_id: selected.exercise_id,
      pr_snapshot: {
        metric: "weight_increase",
        exercise_id: selected.exercise_id,
        exercise_name: exName,
        last_done_at: selected.last_done_at,
        recent_best_weight: selected.recent_best_weight,
        prev_best_weight: selected.prev_best_weight,
        pr_delta: selected.pr_delta,
        is_pr: !!selected.is_pr,
        note: "Created from Create PR flow (UX stub)",
      },
    };

    router.push({
      pathname: "/features/social/create/review",
      params: { draft: JSON.stringify(draft) },
    });
  };

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.bg }}
      edges={["top", "left", "right"]}
    >
      <View style={styles.screen}>
        <Text style={styles.title}>Share PR</Text>
        <Text style={styles.sub}>
          Picks from exercises you’ve actually done, ordered by biggest PR delta.
        </Text>

        <View style={styles.card}>
          <Text style={styles.sub}>Visibility</Text>
          <View style={styles.pillRow}>
            {(["public", "followers", "private"] as const).map((v) => (
              <Pressable
                key={v}
                onPress={() => setVisibility(v)}
                style={[styles.pill, visibility === v && styles.pillOn]}
              >
                <Text style={styles.pillText}>{v}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.sub}>Caption</Text>
          <TextInput
            value={caption}
            onChangeText={setCaption}
            placeholder="PR caption…"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
          />

          <Text style={styles.sub}>Exercise (pick one)</Text>

          {err ? <Text style={styles.error}>{err}</Text> : null}

          {loading ? (
            <ActivityIndicator />
          ) : (
            <FlatList
              data={rows}
              keyExtractor={(i) => i.exercise_id}
              renderItem={({ item }) => {
                const on = selected?.exercise_id === item.exercise_id;

                const delta = fmtNum(item.pr_delta);
                const recent = fmtNum(item.recent_best_weight);
                const prev = fmtNum(item.prev_best_weight);

                return (
                  <Pressable
                    onPress={() => setSelected(item)}
                    style={[styles.row, on && styles.rowOn]}
                  >
                    <View style={styles.rowTop}>
                      <Text style={styles.name} numberOfLines={1}>
                        {item.exercise_name ?? "—"}
                      </Text>

                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>
                          {item.is_pr ? `PR +${delta}` : `Δ ${delta}`}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.metaRow}>
                      <Text style={styles.meta}>Last: {fmtDate(item.last_done_at)}</Text>
                      <Text style={styles.meta}>Recent best: {recent}</Text>
                      <Text style={styles.meta}>Prev best: {prev}</Text>
                    </View>
                  </Pressable>
                );
              }}
            />
          )}

          <Pressable
            style={[styles.btn, { opacity: selected ? 1 : 0.5 }]}
            onPress={goReview}
            disabled={!selected}
          >
            <Text style={styles.btnText}>Review</Text>
          </Pressable>

          <Pressable style={styles.ghost} onPress={() => router.back()}>
            <Text style={styles.ghostText}>Back</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}