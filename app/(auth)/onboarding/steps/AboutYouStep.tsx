import React, { useMemo } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { useAppTheme } from "../../../../lib/useAppTheme";
import type { ErrorMap, Gender, OnboardingDraft } from "../types";

import { Stepper } from "../components/Stepper";
import { Field } from "../components/Field";
import { SegmentRow } from "../components/SegmentRow";
import { PrimaryCTA } from "../components/PrimaryCTA";

export function AboutYouStep({
  draft,
  errors,
  onChange,
  onOpenDob,
  onNext,
  // stepper labels passed from hub so it stays coherent
  stepLabel = "STEP 1 OF 4",
  progress = 0.25,
}: {
  draft: OnboardingDraft;
  errors: ErrorMap;
  onChange: <K extends keyof OnboardingDraft>(key: K, value: OnboardingDraft[K]) => void;
  onOpenDob: () => void;
  onNext: () => void;
  stepLabel?: string;
  progress?: number; // 0..1
}) {
  const { colors } = useAppTheme() as any;
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const dobLabel = draft.dob ? formatDob(draft.dob) : "Tap to select";

  return (
    <View style={styles.page}>
      <View style={styles.body}>
        <Stepper label={stepLabel} progress={progress} />

        <View style={styles.header}>
          <Text style={styles.h1}>About You</Text>
          <Text style={styles.sub}>
            We'll use this information to personalize your training experience and calculate your metrics.
          </Text>
        </View>

        <Field label="FULL NAME" error={errors.fullName}>
          <TextInput
            style={[styles.input, !!errors.fullName && styles.inputError]}
            placeholder="John Doe"
            placeholderTextColor={colors.textMuted}
            value={draft.fullName}
            onChangeText={(t) => onChange("fullName", t)}
            autoCapitalize="words"
            returnKeyType="next"
          />
        </Field>

        <Field label="EMAIL ADDRESS">
          <TextInput
            style={[styles.input, styles.readOnly]}
            placeholder="john.doe@musclemetric.com"
            placeholderTextColor={colors.textMuted}
            value={draft.email}
            editable={false}
          />
        </Field>

        <Field label="DATE OF BIRTH" error={errors.dob}>
          <Pressable
            onPress={onOpenDob}
            style={[styles.input, styles.rowInput, !!errors.dob && styles.inputError]}
          >
            <Text
              style={[
                styles.rowText,
                { color: draft.dob ? colors.text : colors.textMuted },
              ]}
            >
              {dobLabel}
            </Text>
            <Text style={styles.chev}>›</Text>
          </Pressable>
        </Field>

        <Field label="GENDER" error={errors.gender}>
          <SegmentRow<Gender>
            value={draft.gender}
            onChange={(g) => onChange("gender", g)}
            options={[
              { value: "male", label: "Male" },
              { value: "female", label: "Female" }
            ]}
            error={!!errors.gender}
          />
        </Field>
      </View>

      <PrimaryCTA
        title="Next"
        onPress={onNext}
        rightIcon={<Text style={styles.arrow}>→</Text>}
      />
    </View>
  );
}

function formatDob(d: Date) {
  // "Oct 24, 1994"
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

const makeStyles = (colors: any) =>
  StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.background },
    body: { flex: 1, paddingTop: 6, paddingHorizontal: 16 },

    header: {
      marginTop: 10,
      marginBottom: 22,
    },
    h1: {
      color: colors.text,
      fontSize: 34,
      fontWeight: "900",
      letterSpacing: -0.8,
    },
    sub: {
      color: colors.textMuted,
      marginTop: 10,
      fontSize: 14,
      lineHeight: 20,
      fontWeight: "700",
      maxWidth: 360,
    },

    input: {
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.10)",
      borderRadius: 18,
      paddingHorizontal: 16,
      paddingVertical: 16,
      backgroundColor: "rgba(255,255,255,0.04)",
      color: colors.text,
      fontWeight: "800",
      fontSize: 14,
    },
    readOnly: {
      opacity: 0.95,
    },
    inputError: {
      borderColor: "rgba(239,68,68,0.75)",
    },

    rowInput: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
    },
    leftIcon: {
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: "rgba(255,255,255,0.05)",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: "rgba(255,255,255,0.10)",
      alignItems: "center",
      justifyContent: "center",
    },
    leftIconText: {
      fontSize: 14,
      opacity: 0.9,
    },
    rowText: {
      flex: 1,
      fontSize: 14,
      fontWeight: "800",
    },
    chev: {
      color: colors.textMuted,
      fontSize: 18,
      fontWeight: "900",
      marginTop: -2,
    },

    arrow: { color: "#fff", fontWeight: "900", fontSize: 16, marginTop: -1 },
  });
