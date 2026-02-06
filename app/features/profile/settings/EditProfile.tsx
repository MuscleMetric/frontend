// app/features/profile/settings/EditProfile.tsx
import { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  Modal,
  Platform,
  ActivityIndicator,
  Pressable,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";

import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/authContext";
import { useAppTheme } from "@/lib/useAppTheme";
import { Card, Button, Pill, ScreenHeader, Icon } from "@/ui";

type LevelKey = "beginner" | "intermediate" | "advanced";
type GoalKey = "build_muscle" | "lose_fat" | "get_stronger" | "improve_fitness";

const LEVEL_OPTIONS: Array<{ key: LevelKey; label: string }> = [
  { key: "beginner", label: "Beginner" },
  { key: "intermediate", label: "Intermediate" },
  { key: "advanced", label: "Advanced" },
];

const GOAL_OPTIONS: Array<{ key: GoalKey; label: string }> = [
  { key: "build_muscle", label: "Build muscle" },
  { key: "lose_fat", label: "Lose fat" },
  { key: "get_stronger", label: "Get stronger" },
  { key: "improve_fitness", label: "Improve fitness" },
];

/* ---------- helpers ---------- */
function toISODate(d: Date) {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
    .toISOString()
    .slice(0, 10);
}
function parseISODate(s?: string | null) {
  if (!s) return null;
  const [y, m, d] = s.split("-").map((n) => parseInt(n, 10));
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}
function safeNumberOrNull(v: string) {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return n;
}
function onlyNumeric(v: string) {
  return v.replace(/[^\d.]/g, "");
}
function fmtGoalLabel(key: GoalKey) {
  return GOAL_OPTIONS.find((g) => g.key === key)?.label ?? "—";
}
function fmtLevelLabel(key: LevelKey) {
  return LEVEL_OPTIONS.find((l) => l.key === key)?.label ?? "—";
}

function initialsFromName(name?: string | null) {
  const n = (name ?? "").trim();
  if (!n) return "U";
  const parts = n.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return (
    parts[0].slice(0, 1).toUpperCase() +
    parts[parts.length - 1].slice(0, 1).toUpperCase()
  );
}

export default function EditProfile() {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  const { colors, typography, layout } = useAppTheme();
  const styles = useMemo(
    () => makeStyles({ colors, typography, layout }),
    [colors, typography, layout]
  );

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");

  const [settings, setSettings] = useState<any>({});
  const [level, setLevel] = useState<LevelKey>("intermediate");
  const [primaryGoal, setPrimaryGoal] = useState<GoalKey>("build_muscle");

  const [dobIso, setDobIso] = useState<string>("");
  const [showDobPicker, setShowDobPicker] = useState(false);
  const [tempDobDate, setTempDobDate] = useState<Date>(new Date(2000, 0, 1));

  useEffect(() => {
    if (!userId) return;

    (async () => {
      setLoading(true);

      const { data, error } = await supabase
        .from("profiles")
        .select("name, email, height, weight, date_of_birth, settings")
        .eq("id", userId)
        .single();

      if (error) console.warn("EditProfile load error", error);

      if (data) {
        setName(data.name ?? "");
        setEmail(data.email ?? "");
        setHeight(data.height != null ? String(data.height) : "");
        setWeight(data.weight != null ? String(data.weight) : "");

        const d = parseISODate(data.date_of_birth);
        if (d) {
          setDobIso(toISODate(d));
          setTempDobDate(d);
        } else {
          setDobIso("");
          setTempDobDate(new Date(2000, 0, 1));
        }

        const s = data.settings ?? {};
        setSettings(s);
        setLevel((s.level ?? "intermediate") as LevelKey);
        setPrimaryGoal((s.primaryGoal ?? "build_muscle") as GoalKey);
      }

      setLoading(false);
    })();
  }, [userId]);

  const canSave = !!userId && !saving;

  async function handleSave() {
    if (!userId) return;

    try {
      setSaving(true);

      const newSettings = {
        ...(settings ?? {}),
        level,
        primaryGoal,
      };

      const { error } = await supabase
        .from("profiles")
        .update({
          name: name.trim(),
          // NOTE: you probably want this read-only long term (auth email)
          email: email.trim(),
          height: height ? safeNumberOrNull(height) : null,
          weight: weight ? safeNumberOrNull(weight) : null,
          date_of_birth: dobIso || null,
          settings: newSettings,
        })
        .eq("id", userId);

      if (error) throw error;

      router.back();
    } catch (e: any) {
      console.warn("EditProfile save error", e?.message ?? e);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView edges={["top", "left", "right"]} style={styles.safe}>
        <View style={styles.centered}>
          <ActivityIndicator />
        </View>
      </SafeAreaView>
    );
  }

  const initials = initialsFromName(name);

  return (
    <SafeAreaView edges={["left", "right"]} style={styles.safe}>
      <ScreenHeader
        title="Edit profile"
        right={
          <Pressable
            onPress={handleSave}
            disabled={!canSave}
            hitSlop={10}
            style={({ pressed }) => [
              styles.saveTextBtn,
              {
                opacity: !canSave ? 0.45 : pressed ? 0.65 : 1,
              },
            ]}
          >
            <Text
              style={[
                styles.saveText,
                { color: canSave ? colors.text : colors.textMuted },
              ]}
            >
              {saving ? "Saving" : "Save"}
            </Text>
          </Pressable>
        }
      />

      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        {/* Basics */}
        <Card>
          <Text style={styles.sectionTitle}>Basics</Text>

          <View style={styles.avatarRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Full name</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              style={styles.input}
              placeholder="Your name"
              placeholderTextColor={colors.textMuted}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <View style={styles.lockedWrap}>
              <TextInput
                value={email}
                editable={false}
                style={[styles.input, styles.lockedInput]}
                placeholder="you@example.com"
                placeholderTextColor={colors.textMuted}
              />
              <View style={styles.lockIcon}>
                <Icon name="lock-closed" size={16} color={colors.textMuted} />
              </View>
            </View>
          </View>
        </Card>

        {/* Body */}
        <Card>
          <Text style={styles.sectionTitle}>Body stats</Text>

          <View style={styles.row2}>
            <View style={styles.flex1}>
              <Text style={styles.label}>Height (cm)</Text>
              <TextInput
                value={height}
                onChangeText={(v) => setHeight(onlyNumeric(v))}
                style={styles.input}
                keyboardType="numeric"
                placeholder="175"
                placeholderTextColor={colors.textMuted}
              />
            </View>

            <View style={styles.flex1}>
              <Text style={styles.label}>Weight (kg)</Text>
              <TextInput
                value={weight}
                onChangeText={(v) => setWeight(onlyNumeric(v))}
                style={styles.input}
                keyboardType="numeric"
                placeholder="70"
                placeholderTextColor={colors.textMuted}
              />
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Date of birth</Text>

            <Pressable
              onPress={() => setShowDobPicker(true)}
              style={({ pressed }) => [
                styles.dobButton,
                { opacity: pressed ? 0.75 : 1 },
              ]}
            >
              <Text style={styles.dobButtonText}>
                {dobIso ? dobIso : "Change"}
              </Text>
            </Pressable>
          </View>
        </Card>

        {/* Training profile */}
        <Card>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Training profile</Text>
            <Pill
              tone="neutral"
              label={`${fmtLevelLabel(level)} · ${fmtGoalLabel(primaryGoal)}`}
            />
          </View>

          <Text style={styles.label}>Fitness level</Text>
          <View style={styles.segmentRow}>
            {LEVEL_OPTIONS.map((opt) => {
              const active = level === opt.key;
              return (
                <Pressable
                  key={opt.key}
                  onPress={() => setLevel(opt.key)}
                  style={({ pressed }) => [
                    styles.segmentPill,
                    active ? styles.segmentActive : styles.segmentIdle,
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      { color: active ? colors.text : colors.textMuted },
                    ]}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={{ height: layout.space.md }} />

          <Text style={styles.label}>Primary goal</Text>
          <View style={styles.segmentWrap}>
            {GOAL_OPTIONS.map((opt) => {
              const active = primaryGoal === opt.key;
              return (
                <Pressable
                  key={opt.key}
                  onPress={() => setPrimaryGoal(opt.key)}
                  style={({ pressed }) => [
                    styles.segmentPill,
                    active ? styles.segmentActive : styles.segmentIdle,
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      { color: active ? colors.text : colors.textMuted },
                    ]}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Card>

        {/* Sticky-ish CTA mimic: still keep in content for Android scroll */}
        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Bottom CTA bar */}
      <View style={styles.bottomBar}>
        <Button
          title={saving ? "Saving…" : "Save changes"}
          onPress={handleSave}
          disabled={!canSave}
        />
        <Text style={styles.footerHint}>You can update this anytime</Text>
      </View>

      {/* DOB picker */}
      <Modal
        visible={showDobPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDobPicker(false)}
      >
        <View style={styles.modalScrim}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Date of birth</Text>
              <Pill tone="neutral" label="Optional" />
            </View>

            <DateTimePicker
              value={tempDobDate}
              mode="date"
              display={Platform.OS === "ios" ? "spinner" : "default"}
              maximumDate={new Date()}
              onChange={(_, d) => d && setTempDobDate(d)}
            />

            <View style={styles.modalActions}>
              <View style={{ flex: 1 }}>
                <Button
                  variant="secondary"
                  title="Cancel"
                  onPress={() => setShowDobPicker(false)}
                />
              </View>

              <View style={{ flex: 1 }}>
                <Button
                  title="Done"
                  onPress={() => {
                    setDobIso(toISODate(tempDobDate));
                    setShowDobPicker(false);
                  }}
                />
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function makeStyles({
  colors,
  typography,
  layout,
}: {
  colors: any;
  typography: any;
  layout: any;
}) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },

    container: {
      padding: layout.space.lg,
      paddingBottom: layout.space.xxl,
      gap: layout.space.md,
    },

    centered: { flex: 1, alignItems: "center", justifyContent: "center" },

    saveTextBtn: {
      paddingHorizontal: 6,
      paddingVertical: 6,
      borderRadius: 10,
    },
    saveText: {
      fontFamily: typography.fontFamily.semibold,
      fontSize: typography.size.sub,
      lineHeight: typography.lineHeight.sub,
    },

    sectionHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: layout.space.sm,
      gap: layout.space.md,
    },

    sectionTitle: {
      fontFamily: typography.fontFamily.bold,
      fontSize: typography.size.sub,
      lineHeight: typography.lineHeight.sub,
      color: colors.textMuted,
      marginBottom: layout.space.sm,
    },

    avatarRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: layout.space.md,
      marginBottom: layout.space.md,
    },
    avatar: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarText: {
      fontFamily: typography.fontFamily.regular,
      fontSize: typography.size.hero,
      color: colors.text,
    },
    linkText: {
      fontFamily: typography.fontFamily.semibold,
      fontSize: typography.size.sub,
      lineHeight: typography.lineHeight.sub,
      color: colors.primary,
    },

    field: { gap: 6, marginBottom: layout.space.md },

    label: {
      fontFamily: typography.fontFamily.medium,
      fontSize: typography.size.meta,
      lineHeight: typography.lineHeight.meta,
      color: colors.text,
    },

    input: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      borderRadius: layout.radius.lg,
      paddingHorizontal: layout.space.md,
      paddingVertical: 12,
      color: colors.text,
      fontFamily: typography.fontFamily.regular,
      fontSize: typography.size.body,
      lineHeight: typography.lineHeight.body,
    },

    lockedWrap: {
      position: "relative",
      justifyContent: "center",
    },
    lockedInput: {
      color: colors.textMuted,
      paddingRight: 40,
    },
    lockIcon: {
      position: "absolute",
      right: 12,
      top: "50%",
      transform: [{ translateY: -8 }],
    },

    row2: { flexDirection: "row", gap: layout.space.md },
    flex1: { flex: 1 },

    dobButton: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      borderRadius: layout.radius.lg,
      paddingHorizontal: layout.space.md,
      paddingVertical: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    dobButtonText: {
      fontFamily: typography.fontFamily.semibold,
      fontSize: typography.size.body,
      lineHeight: typography.lineHeight.body,
      color: colors.text,
    },

    segmentRow: {
      flexDirection: "row",
      gap: layout.space.sm,
      flexWrap: "wrap",
    },
    segmentWrap: {
      flexDirection: "row",
      gap: layout.space.sm,
      flexWrap: "wrap",
    },

    segmentPill: {
      paddingHorizontal: layout.space.md,
      paddingVertical: 10,
      borderRadius: layout.radius.pill,
      borderWidth: StyleSheet.hairlineWidth,
    },
    segmentIdle: {
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    segmentActive: {
      borderColor: colors.trackBorder,
      backgroundColor: colors.trackBg,
    },
    segmentText: {
      fontFamily: typography.fontFamily.semibold,
      fontSize: typography.size.meta,
      lineHeight: typography.lineHeight.meta,
    },

    bottomSpacer: { height: 90 },

    bottomBar: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: layout.space.lg,
      paddingTop: layout.space.md,
      paddingBottom: layout.space.lg,
      backgroundColor: colors.bg,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    footerHint: {
      marginTop: layout.space.sm,
      textAlign: "center",
      fontFamily: typography.fontFamily.regular,
      fontSize: typography.size.meta,
      lineHeight: typography.lineHeight.meta,
      color: colors.textMuted,
    },

    modalScrim: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: "flex-end",
      padding: layout.space.md,
    },
    modalCard: {
      backgroundColor: colors.surface,
      borderRadius: layout.radius.xl,
      padding: layout.space.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      gap: layout.space.md,
    },
    modalHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: layout.space.md,
    },
    modalTitle: {
      fontFamily: typography.fontFamily.bold,
      fontSize: typography.size.h3,
      lineHeight: typography.lineHeight.h3,
      color: colors.text,
    },
    modalActions: {
      flexDirection: "row",
      gap: layout.space.sm,
    },
  });
}
