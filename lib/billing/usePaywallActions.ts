import { Alert } from "react-native";
import { useMemo, useState } from "react";
import type { PurchasesPackage } from "react-native-purchases";
import {
  purchaseRevenueCatPackage,
  restoreRevenueCatPurchases,
} from "./revenuecat";
import { useAuth } from "@/lib/authContext";
import { useBilling } from "./BillingProvider";

type PurchaseUnavailableReason =
  | "loading"
  | "offerings_error"
  | "no_packages"
  | null;

export function usePaywallActions(onClose?: () => void) {
  const { refreshEntitlements } = useAuth();
  const { offering, loading, error, refresh } = useBilling();
  const [busy, setBusy] = useState(false);

  const monthly = useMemo(
    () =>
      offering?.monthly ??
      offering?.availablePackages.find((p) => p.packageType === "MONTHLY") ??
      null,
    [offering],
  );

  const annual = useMemo(
    () =>
      offering?.annual ??
      offering?.availablePackages.find((p) => p.packageType === "ANNUAL") ??
      null,
    [offering],
  );

  const defaultPackage = useMemo(
    () => annual ?? monthly ?? null,
    [annual, monthly],
  );

  const hasPackages = !!defaultPackage;

  const purchaseUnavailableReason: PurchaseUnavailableReason = useMemo(() => {
    if (loading) return "loading";
    if (error) return "offerings_error";
    if (!defaultPackage) return "no_packages";
    return null;
  }, [loading, error, defaultPackage]);

  const canStartPurchase = !busy && !purchaseUnavailableReason;

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

  const startDefaultPurchase = async () => {
    if (busy) return;

    if (loading) {
      Alert.alert("Please wait", "We’re still loading purchase options.");
      return;
    }

    if (error) {
      Alert.alert(
        "Purchases unavailable",
        "We couldn’t load purchase options right now. Please try again.",
      );
      return;
    }

    if (!defaultPackage) {
      Alert.alert(
        "Purchases unavailable",
        "Purchase options are not available right now.",
      );
      return;
    }

    await purchaseSelected(defaultPackage);
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
    defaultPackage,
    hasPackages,
    purchaseUnavailableReason,
    canStartPurchase,
    purchaseSelected,
    startDefaultPurchase,
    restore,
  };
}