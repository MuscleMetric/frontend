import { Alert } from "react-native";
import { useMemo, useState } from "react";
import type { PurchasesPackage } from "react-native-purchases";
import {
  purchaseRevenueCatPackage,
  restoreRevenueCatPurchases,
} from "./revenuecat";
import { useRevenueCatOffering } from "./useRevenueCatOffering";
import { useAuth } from "@/lib/authContext";

export function usePaywallActions(onClose?: () => void) {
  const { refreshEntitlements } = useAuth();
  const { offering, loading, error, refresh } = useRevenueCatOffering();
  const [busy, setBusy] = useState(false);

  const monthly = useMemo(
    () =>
      offering?.monthly ??
      offering?.availablePackages.find((p) => p.packageType === "MONTHLY") ??
      null,
    [offering]
  );

  const annual = useMemo(
    () =>
      offering?.annual ??
      offering?.availablePackages.find((p) => p.packageType === "ANNUAL") ??
      null,
    [offering]
  );

  const purchaseSelected = async (pkg: PurchasesPackage) => {
    try {
      setBusy(true);
      await purchaseRevenueCatPackage(pkg);
      await refreshEntitlements();
      Alert.alert("Success", "MuscleMetric Pro is now active.");
      onClose?.();
    } catch (err: any) {
      if (err?.userCancelled) return;
      Alert.alert("Purchase failed", err?.message ?? "Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const restore = async () => {
    try {
      setBusy(true);
      await restoreRevenueCatPurchases();
      await refreshEntitlements();
      Alert.alert("Restored", "Your purchases have been restored.");
      onClose?.();
    } catch (err: any) {
      Alert.alert("Restore failed", err?.message ?? "Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return {
    offering,
    loading,
    error,
    refresh,
    busy,
    monthly,
    annual,
    purchaseSelected,
    restore,
  };
}