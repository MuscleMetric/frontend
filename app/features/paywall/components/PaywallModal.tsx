import React from "react";
import {
  Modal,
  View,
  StyleSheet,
  Pressable,
  Text,
  SafeAreaView,
} from "react-native";
import { X } from "lucide-react-native";
import PaywallContent, { PaywallReason } from "./PaywallContent";

type PaywallModalProps = {
  visible: boolean;
  reason?: PaywallReason;
  onClose: () => void;
  onStartTrial: () => void;
  onRestorePurchases?: () => void;
};

export default function PaywallModal({
  visible,
  reason = "generic",
  onClose,
  onStartTrial,
  onRestorePurchases,
}: PaywallModalProps) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.topBar}>
          <Pressable
            onPress={onClose}
            hitSlop={12}
            style={styles.closeButton}
            accessibilityRole="button"
            accessibilityLabel="Close paywall"
          >
            <X size={24} color="#DDE5FA" />
          </Pressable>

          <Text style={styles.topSpacer} />
        </View>

        <PaywallContent
          reason={reason}
          onClose={onClose}
          onStartTrial={onStartTrial}
          onRestorePurchases={onRestorePurchases}
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#081120",
  },
  topBar: {
    backgroundColor: "#081120",
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  topSpacer: {
    width: 40,
  },
});