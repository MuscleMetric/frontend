import { Alert } from "react-native";
import { useMemo, useState } from "react";
import type { PurchasesPackage } from "react-native-purchases";
import {
  purchaseRevenueCatPackage,
  restoreRevenueCatPurchases,
} from "./revenuecat";
import { useAuth } from "@/lib/authContext";
import { useBilling } from "./BillingProvider";
import type { PaywallPlan } from "@/app/features/paywall/components/PaywallContent";

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
      offering?.availablePackages.find((p) => p.identifier === "$rc_monthly") ??
      offering?.availablePackages.find(
        (p) => p.product.identifier === "mm_pro_monthly",
      ) ??
      null,
    [offering],
  );

  const annual = useMemo(
    () =>
      offering?.annual ??
      offering?.availablePackages.find((p) => p.identifier === "$rc_annual") ??
      offering?.availablePackages.find(
        (p) => p.product.identifier === "mm_pro_annual",
      ) ??
      null,
    [offering],
  );

  console.log("[paywall] offering packages", {
    offeringId: offering?.identifier,
    packages: offering?.availablePackages?.map((p) => ({
      identifier: p.identifier,
      packageType: p.packageType,
      productId: p.product.identifier,
      price: p.product.priceString,
    })),
    monthlyPackage: monthly?.identifier,
    annualPackage: annual?.identifier,
  });

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

      console.log("[paywall] purchase starting", {
        packageId: pkg.identifier,
        productId: pkg.product.identifier,
        price: pkg.product.priceString,
      });

      const result = await purchaseRevenueCatPackage(pkg);

      console.log("[paywall] purchase complete", {
        productId: pkg.product.identifier,
        activeEntitlements: Object.keys(
          result.customerInfo.entitlements.active,
        ),
      });

      await refreshEntitlements();
      await refresh();

      Alert.alert("Success", "MuscleMetric Pro is now active.");
      onClose?.();
    } catch (err: any) {
      if (err?.userCancelled) {
        console.log("[paywall] purchase cancelled by user");
        return;
      }

      console.warn("[paywall] purchase failed", {
        message: err?.message,
        code: err?.code,
        underlyingErrorMessage: err?.underlyingErrorMessage,
      });

      Alert.alert("Purchase failed", err?.message ?? "Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const startPurchaseForPlan = async (plan: PaywallPlan) => {
    if (busy) return;

    const selectedPackage = plan === "monthly" ? monthly : annual;

    console.log("[paywall] selected plan", {
      plan,
      selectedPackageId: selectedPackage?.identifier,
      productId: selectedPackage?.product.identifier,
      loading,
      error,
    });

    if (loading) {
      Alert.alert("Please wait", "We’re still loading purchase options.");
      return;
    }

    if (error || !selectedPackage) {
      try {
        setBusy(true);
        await refresh();
      } finally {
        setBusy(false);
      }

      Alert.alert(
        "Purchases unavailable",
        "We couldn’t load purchase options right now. Please check your connection and try again.",
      );

      return;
    }

    await purchaseSelected(selectedPackage);
  };

  const startDefaultPurchase = async () => {
    if (busy) return;

    if (loading) {
      Alert.alert("Please wait", "We’re still loading purchase options.");
      return;
    }

    if (error || !defaultPackage) {
      try {
        setBusy(true);
        await refresh();
      } catch {
        // ignore here; show clean user-facing message below
      } finally {
        setBusy(false);
      }

      Alert.alert(
        "Purchases unavailable",
        "We couldn’t load purchase options right now. Please check your connection and try again.",
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
    startPurchaseForPlan,
    restore,
  };
}
