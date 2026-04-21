import React, { useState } from "react";
import { Modal, View, StyleSheet, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { X } from "lucide-react-native";
import PaywallContent, {
  PaywallReason,
  PaywallPlan,
} from "./PaywallContent";
import { useAppTheme } from "@/lib/useAppTheme";

type PaywallModalProps = {
  visible: boolean;
  reason?: PaywallReason;
  onClose: () => void;
  onStartTrial: (plan: PaywallPlan) => void;
  onRestorePurchases?: () => void;
  onOpenPrivacyPolicy: () => void;
  onOpenTerms: () => void;
  purchaseDisabled?: boolean;
  purchaseStatusText?: string | null;
  initialPlan?: PaywallPlan;
};

export default function PaywallModal({
  visible,
  reason = "generic",
  onClose,
  onStartTrial,
  onRestorePurchases,
  onOpenPrivacyPolicy,
  onOpenTerms,
  purchaseDisabled = false,
  purchaseStatusText = null,
  initialPlan = "yearly",
}: PaywallModalProps) {
  const { colors, layout } = useAppTheme();
  const [selectedPlan, setSelectedPlan] = useState<PaywallPlan>(initialPlan);

  

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaView
        style={[
          styles.safeArea,
          {
            backgroundColor: colors.bg,
          },
        ]}
      >
        <View
          style={[
            styles.topBar,
            {
              backgroundColor: colors.bg,
              borderBottomColor: colors.border,
              paddingHorizontal: layout.space.lg,
            },
          ]}
        >
          <View style={{ flex: 1 }} />
          <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button">
            <X color={colors.text} size={22} />
          </Pressable>
        </View>

        <PaywallContent
          reason={reason}
          selectedPlan={selectedPlan}
          onSelectPlan={setSelectedPlan}
          onStartTrial={() => onStartTrial(selectedPlan)}
          onRestorePurchases={onRestorePurchases}
          onOpenPrivacyPolicy={onOpenPrivacyPolicy}
          onOpenTerms={onOpenTerms}
          onClose={onClose}
          purchaseDisabled={purchaseDisabled}
          purchaseStatusText={purchaseStatusText}
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  topBar: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});