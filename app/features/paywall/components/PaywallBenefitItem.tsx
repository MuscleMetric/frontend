import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { LucideIcon } from "lucide-react-native";

type PaywallBenefitItemProps = {
  icon: LucideIcon;
  title: string;
  description?: string;
  compact?: boolean;
};

export default function PaywallBenefitItem({
  icon: Icon,
  title,
  description,
  compact = false,
}: PaywallBenefitItemProps) {
  return (
    <View style={[styles.card, compact && styles.compactCard]}>
      <View style={styles.iconWrap}>
        <Icon size={18} color="#B4C5FF" />
      </View>

      <View style={styles.textWrap}>
        <Text style={styles.title}>{title}</Text>
        {!!description && <Text style={styles.description}>{description}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#121B2E",
    borderRadius: 22,
    padding: 18,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
  },
  compactCard: {
    minHeight: 112,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(180, 197, 255, 0.10)",
    alignItems: "center",
    justifyContent: "center",
  },
  textWrap: {
    flex: 1,
  },
  title: {
    color: "#F2F5FF",
    fontSize: 18,
    fontWeight: "800",
    lineHeight: 24,
  },
  description: {
    marginTop: 6,
    color: "#B7C0D9",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500",
  },
});