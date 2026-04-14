// app/features/paywall/components/PaywallModal.tsx
import React from "react";
import {
  Modal,
  View,
  StyleSheet,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { X } from "lucide-react-native";
import PaywallContent, { PaywallReason } from "./PaywallContent";
import { useAppTheme } from "@/lib/useAppTheme";

type PaywallModalProps = {
  visible: boolean;
  reason?: PaywallReason;
  onClose: () => void;
  onStartTrial: () => void;
  onRestorePurchases?: () => void;
  purchaseDisabled?: boolean;
  purchaseStatusText?: string | null;
};

export default function PaywallModal({
  visible,
  reason = "generic",
  onClose,
  onStartTrial,
  onRestorePurchases,
  purchaseDisabled = false,
  purchaseStatusText = null,
}: PaywallModalProps) {
  const { colors, layout } = useAppTheme();

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
          onStartTrial={onStartTrial}
          onRestorePurchases={onRestorePurchases}
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