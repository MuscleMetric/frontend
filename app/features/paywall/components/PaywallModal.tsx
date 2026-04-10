import React from "react";
import {
  Modal,
  View,
  StyleSheet,
  Pressable,
  SafeAreaView,
  Text,
} from "react-native";
import { X } from "lucide-react-native";
import PaywallContent, { PaywallReason } from "./PaywallContent";
import { useAppTheme } from "@/lib/useAppTheme";

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
  const { colors, layout, typography } = useAppTheme();

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
              paddingHorizontal: layout.space.md,
              paddingTop: 4,
              paddingBottom: 2,
            },
          ]}
        >
          {/* Left: Close button */}
          <Pressable
            onPress={onClose}
            hitSlop={layout.hitSlop}
            style={[
              styles.closeButton,
              {
                borderRadius: layout.radius.pill,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Close paywall"
          >
            <X size={24} color={colors.text} />
          </Pressable>

          {/* Center: Title (absolute centered) */}
          <View pointerEvents="none" style={styles.centerContainer}>
            <Text
              style={[
                styles.title,
                {
                  color: colors.text,
                  fontFamily: typography.fontFamily?.medium,
                },
              ]}
            >
              MuscleMetricPro
            </Text>
          </View>

          {/* Right: spacer to balance layout */}
          <View style={styles.topSpacer} />
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
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  topSpacer: {
    width: 40,
    height: 40,
  },
  centerContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
  },
});