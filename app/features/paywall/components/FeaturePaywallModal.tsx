// app/features/paywall/components/FeaturePaywallModal.tsx
import React from "react";
import PaywallModal from "./PaywallModal";
import { usePaywallActions } from "@/lib/billing/usePaywallActions";
import type { PaywallReason } from "./PaywallContent";

type FeaturePaywallModalProps = {
  visible: boolean;
  reason: PaywallReason;
  onClose: () => void;
};

function getPurchaseStatusText(
  reason: "loading" | "offerings_error" | "no_packages" | null
) {
  if (reason === "loading") return "Loading purchase options...";
  if (reason === "offerings_error" || reason === "no_packages") {
    return "Purchase options are unavailable right now.";
  }
  return null;
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
      onStartTrial={() => {
        void startDefaultPurchase();
      }}
      onRestorePurchases={() => {
        if (busy) return;
        void restore();
      }}
      purchaseDisabled={!canStartPurchase}
      purchaseStatusText={getPurchaseStatusText(purchaseUnavailableReason)}
    />
  );
}