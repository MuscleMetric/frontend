// app/features/home/cards/HeroCard.tsx
import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useAppTheme } from "../../../../lib/useAppTheme";
import { BaseCard } from "../ui/BaseCard";
import { Pill } from "../ui/Pill";
import { performCTA } from "../cta";

export function HeroCard({ card }: { card: any }) {
  const { colors } = useAppTheme();
  const styles = React.useMemo(() => makeStyles(colors), [colors]);

  const badge = card?.badge ? String(card.badge) : null;
  const title = String(card?.title ?? "");
  const subtitle = card?.subtitle ? String(card.subtitle) : null;

  const primary = card?.primary_cta;
  const secondary = card?.secondary_cta;

  const onPrimary = () => primary?.cta && performCTA(primary.cta);
  const onSecondary = () => secondary?.cta && performCTA(secondary.cta);

  return (
    <BaseCard onPress={onPrimary} style={styles.card}>
      {/* subtle accent blob */}
      <View
        pointerEvents="none"
        style={[
          styles.accentBlob,
          { backgroundColor: colors.primarySoft ?? colors.primaryBg },
        ]}
      />

      <View style={{ gap: 12 }}>
        {badge ? (
          <View style={{ alignSelf: "flex-start" }}>
            <Pill label={badge} tone="primary" />
          </View>
        ) : null}

        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>

        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={3}>
            {subtitle}
          </Text>
        ) : null}

        <View style={{ height: 6 }} />

        <View style={styles.ctaRow}>
          <Pressable
            onPress={onPrimary}
            style={({ pressed }) => [
              styles.primaryBtn,
              pressed ? { opacity: 0.92, transform: [{ scale: 0.995 }] } : null,
            ]}
            hitSlop={6}
          >
            <Text style={styles.primaryText}>
              {String(primary?.label ?? "Continue")}
            </Text>
            <Text style={styles.arrow}>→</Text>
          </Pressable>

          {secondary?.cta ? (
            <Pressable
              onPress={onSecondary}
              style={({ pressed }) => [
                styles.secondaryBtn,
                pressed ? { opacity: 0.9 } : null,
              ]}
              hitSlop={6}
            >
              <Text style={styles.secondaryText}>
                {String(secondary?.label ?? "")}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </BaseCard>
  );
}

const makeStyles = (colors: any) =>
  StyleSheet.create({
    // Only keep what HeroCard needs to override.
    // BaseCard handles background/border/shadow/padding defaults.
    card: {
      padding: 20, // slightly roomier than default cards
      borderRadius: 26,
      overflow: "hidden",
    },

    accentBlob: {
      position: "absolute",
      right: -40,
      top: -30,
      width: 140,
      height: 140,
      borderRadius: 999,
    },

    title: {
      fontSize: 26,
      fontWeight: "900",
      letterSpacing: -0.6,
      color: colors.text,
      lineHeight: 30,
    },

    subtitle: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.subtle,
      lineHeight: 20,
    },

    ctaRow: {
      flexDirection: "row",
      gap: 10,
      alignItems: "center",
    },

    primaryBtn: {
      flex: 1,
      paddingVertical: 13,
      paddingHorizontal: 14,
      borderRadius: 16,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 10,
    },

    primaryText: {
      fontWeight: "900",
      color: "#fff",
      fontSize: 15,
      letterSpacing: 0.2,
    },

    arrow: {
      color: "#fff",
      fontWeight: "900",
      fontSize: 16,
      marginTop: -1,
    },

    secondaryBtn: {
      paddingVertical: 13,
      paddingHorizontal: 14,
      borderRadius: 16,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },

    secondaryText: {
      fontWeight: "900",
      color: colors.text,
      fontSize: 13,
      letterSpacing: 0.2,
    },
  });
