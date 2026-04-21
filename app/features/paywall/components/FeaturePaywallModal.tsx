// app/features/paywall/components/FeaturePaywallModal.tsx
import React from "react";
import { Linking, Alert } from "react-native";
import PaywallModal from "./PaywallModal";
import { usePaywallActions } from "@/lib/billing/usePaywallActions";
import type { PaywallReason, PaywallPlan } from "./PaywallContent";

type FeaturePaywallModalProps = {
  visible: boolean;
  reason: PaywallReason;
  onClose: () => void;
};

function getPurchaseStatusText(
  reason: "loading" | "offerings_error" | "no_packages" | null,
) {
  if (reason === "loading") return "Loading purchase options...";
  if (reason === "offerings_error" || reason === "no_packages") {
    return "Purchase options are unavailable right now.";
  }
  return null;
}

const PRIVACY_POLICY_URL =
  "https://musclemetric.github.io/musclemetric-legal/privacy.html";

const TERMS_OF_USE_URL =
  "https://musclemetric.github.io/musclemetric-legal/terms.html";

async function openExternalUrl(url: string) {
  try {
    const supported = await Linking.canOpenURL(url);

    if (!supported) {
      Alert.alert("Unable to open link", "Please try again later.");
      return;
    }

    await Linking.openURL(url);
  } catch {
    Alert.alert("Unable to open link", "Please try again later.");
  }
}

export default function FeaturePaywallModal({
  visible,
  reason,
  onClose,
}: FeaturePaywallModalProps) {
  const {
    startDefaultPurchase,
    restore,
    busy,
    canStartPurchase,
    purchaseUnavailableReason,
  } = usePaywallActions(onClose);

  return (
    <PaywallModal
      visible={visible}
      reason={reason}
      onClose={onClose}
      onStartTrial={(plan: PaywallPlan) => {
        if (busy) return;
        void startDefaultPurchase();
      }}
      onRestorePurchases={() => {
        if (busy) return;
        void restore();
      }}
      onOpenPrivacyPolicy={() => {
        void openExternalUrl(PRIVACY_POLICY_URL);
      }}
      onOpenTerms={() => {
        void openExternalUrl(TERMS_OF_USE_URL);
      }}
      purchaseDisabled={!canStartPurchase || busy}
      purchaseStatusText={getPurchaseStatusText(purchaseUnavailableReason)}
      initialPlan="yearly"
    />
  );
}