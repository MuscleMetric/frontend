// features/settings/components/SubscriptionSettingsCard.tsx
import React, { useMemo, useState } from "react";
import { Alert, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { Crown, RefreshCcw, ExternalLink } from "lucide-react-native";

import { useAppTheme } from "@/lib/useAppTheme";
import { useAuth } from "@/lib/authContext";
import { restoreRevenueCatPurchases } from "@/lib/billing/revenuecat";

const APPLE_MANAGE_SUBSCRIPTION_URL =
  "https://apps.apple.com/account/subscriptions";

function fmtDate(iso?: string | null) {
  if (!iso) return "Not set";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "Not set";

  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function titleCase(value?: string | null) {
  if (!value) return "Not set";
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function getPlanLabel(productCode?: string | null) {
  if (productCode === "mm_pro_monthly") return "MuscleMetric Pro Monthly";
  if (productCode === "mm_pro_annual") return "MuscleMetric Pro Yearly";
  return "Free";
}

export function SubscriptionSettingsCard() {
  const { colors, typography, layout } = useAppTheme();
  const { entitlements, refreshEntitlements } = useAuth();
  const [busy, setBusy] = useState(false);

  const isPro = entitlements?.tier === "pro";
  const status = entitlements?.status ?? "free";
  const productCode = entitlements?.productCode ?? null;

  const renewalLabel =
    status === "trial"
      ? "Trial ends"
      : ["active", "cancelled_active", "grace"].includes(status)
        ? "Renews / access until"
        : "Access until";

  const renewalDate =
    entitlements?.nextRenewalAt ??
    entitlements?.effectiveUntil ??
    entitlements?.trialEndsAt ??
    null;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: layout.radius.xl,
          padding: layout.space.lg,
          gap: layout.space.md,
        },
        topRow: {
          flexDirection: "row",
          alignItems: "center",
          gap: layout.space.md,
        },
        iconWrap: {
          width: 40,
          height: 40,
          borderRadius: 20,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.cardPressed,
        },
        title: {
          color: colors.text,
          fontFamily: typography.fontFamily.bold,
          fontSize: typography.size.h3,
          lineHeight: typography.lineHeight.h3,
        },
        subtitle: {
          color: colors.textMuted,
          fontFamily: typography.fontFamily.medium,
          fontSize: typography.size.sub,
          lineHeight: typography.lineHeight.sub,
          marginTop: 2,
        },
        infoGrid: {
          gap: 10,
          paddingTop: layout.space.sm,
        },
        infoRow: {
          flexDirection: "row",
          justifyContent: "space-between",
          gap: layout.space.md,
        },
        label: {
          color: colors.textMuted,
          fontFamily: typography.fontFamily.medium,
          fontSize: typography.size.sub,
        },
        value: {
          flex: 1,
          color: colors.text,
          fontFamily: typography.fontFamily.semibold,
          fontSize: typography.size.sub,
          textAlign: "right",
        },
        actions: {
          gap: layout.space.sm,
          paddingTop: layout.space.sm,
        },
        button: {
          minHeight: 48,
          borderRadius: layout.radius.lg,
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "row",
          gap: 8,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.bg,
        },
        primaryButton: {
          backgroundColor: colors.primary,
          borderColor: colors.primary,
        },
        buttonText: {
          color: colors.text,
          fontFamily: typography.fontFamily.semibold,
          fontSize: typography.size.body,
        },
        primaryButtonText: {
          color: colors.onPrimary,
        },
      }),
    [colors, typography, layout],
  );

  async function onRestore() {
    try {
      setBusy(true);
      await restoreRevenueCatPurchases();
      await refreshEntitlements();
      Alert.alert("Restored", "Your purchases have been restored.");
    } catch (err: any) {
      Alert.alert("Restore failed", err?.message ?? "Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function onManage() {
    const ok = await Linking.canOpenURL(APPLE_MANAGE_SUBSCRIPTION_URL);

    if (!ok) {
      Alert.alert("Unable to open subscriptions", "Please try again later.");
      return;
    }

    await Linking.openURL(APPLE_MANAGE_SUBSCRIPTION_URL);
  }

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.iconWrap}>
          <Crown size={20} color={colors.primary} />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.title}>
            {isPro ? "MuscleMetric Pro" : "Free Plan"}
          </Text>
          <Text style={styles.subtitle}>
            View, restore, or manage your subscription.
          </Text>
        </View>
      </View>

      <View style={styles.infoGrid}>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Tier</Text>
          <Text style={styles.value}>{isPro ? "Pro" : "Free"}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.label}>Status</Text>
          <Text style={styles.value}>{titleCase(status)}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.label}>Plan</Text>
          <Text style={styles.value}>{getPlanLabel(productCode)}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.label}>{renewalLabel}</Text>
          <Text style={styles.value}>{fmtDate(renewalDate)}</Text>
        </View>
      </View>

      <View style={styles.actions}>
        <Pressable
          onPress={onRestore}
          disabled={busy}
          style={({ pressed }) => [
            styles.button,
            { opacity: pressed || busy ? 0.6 : 1 },
          ]}
        >
          <RefreshCcw size={17} color={colors.text} />
          <Text style={styles.buttonText}>
            {busy ? "Restoring..." : "Restore Purchases"}
          </Text>
        </Pressable>

        <Pressable
          onPress={onManage}
          style={({ pressed }) => [
            styles.button,
            styles.primaryButton,
            { opacity: pressed ? 0.75 : 1 },
          ]}
        >
          <ExternalLink size={17} color={colors.onPrimary} />
          <Text style={[styles.buttonText, styles.primaryButtonText]}>
            Manage Subscription
          </Text>
        </Pressable>
      </View>
    </View>
  );
}