import React, { useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
} from "react-native";
import {
  TrendingUp,
  LineChart,
  CalendarPlus,
  Target,
  ShieldCheck,
  CalendarCheck2,
  Sparkles,
} from "lucide-react-native";
import PaywallBenefitItem from "./PaywallBenefitItem";

export type PaywallReason =
  | "deep_analytics"
  | "template_limit"
  | "goal_limit"
  | "plan_limit"
  | "generic";

type Benefit = {
  icon: any;
  title: string;
  description?: string;
};

type PaywallContentModel = {
  eyebrow?: string;
  title: string;
  subtitle: string;
  metricLabel: string;
  metricValue: string;
  primaryCta: string;
  pricingLine: string;
  benefits: Benefit[];
};

type PaywallContentProps = {
  reason: PaywallReason;
  onStartTrial: () => void;
  onRestorePurchases?: () => void;
  onClose: () => void;
};

function getContent(reason: PaywallReason): PaywallContentModel {
  switch (reason) {
    case "template_limit":
      return {
        eyebrow: "MuscleMetric Pro",
        title: "Create More Workout Templates",
        subtitle:
          "Save more workouts, build a bigger training library, and keep your programming organised.",
        metricLabel: "Template limit",
        metricValue: "5 → 15",
        primaryCta: "Start Free Trial",
        pricingLine: "£2.99/month or £31.99/year (Save 10%)",
        benefits: [
          {
            icon: CalendarPlus,
            title: "Save more workout templates",
            description:
              "Build a deeper library of workouts for different goals, splits, and training phases.",
          },
          {
            icon: TrendingUp,
            title: "Keep long-term programming organised",
            description:
              "Store more variations as your training evolves instead of deleting older templates.",
          },
          {
            icon: Target,
            title: "Unlock more goals per plan",
            description:
              "Track more target lifts and training outcomes inside each plan.",
          },
          {
            icon: Sparkles,
            title: "Access Pro planning tools",
            description:
              "Get expanded planning limits and premium training surfaces as you grow.",
          },
        ],
      };

    case "goal_limit":
      return {
        eyebrow: "MuscleMetric Pro",
        title: "Track More Goals",
        subtitle:
          "Set more goals inside each plan so your progress is clearer and your training stays focused.",
        metricLabel: "Goals per plan",
        metricValue: "2 → 5",
        primaryCta: "Start Free Trial",
        pricingLine: "£2.99/month or £31.99/year (Save 10%)",
        benefits: [
          {
            icon: Target,
            title: "Track more targets per plan",
            description:
              "Set multiple exercise and performance goals without running into free limits.",
          },
          {
            icon: TrendingUp,
            title: "Measure progress more clearly",
            description:
              "Keep strength, volume, and milestone targets in one structured place.",
          },
          {
            icon: LineChart,
            title: "Connect goals to deeper insights",
            description:
              "Use premium analytics to understand whether your plan is moving you forward.",
          },
          {
            icon: Sparkles,
            title: "Train with more intent",
            description:
              "Keep more of your training focused around real outcomes, not guesswork.",
          },
        ],
      };

    case "plan_limit":
      return {
        eyebrow: "MuscleMetric Pro",
        title: "Unlock More Active Plans",
        subtitle:
          "Run more plans at once for different goals, phases, or training styles.",
        metricLabel: "Active plans",
        metricValue: "1 → 3",
        primaryCta: "Start Free Trial",
        pricingLine: "£2.99/month or £31.99/year (Save 10%)",
        benefits: [
          {
            icon: CalendarPlus,
            title: "Create more active plans",
            description:
              "Manage more than one plan at a time for different priorities and phases.",
          },
          {
            icon: Target,
            title: "Separate goals more cleanly",
            description:
              "Keep hypertrophy, strength, or special-focus blocks organised properly.",
          },
          {
            icon: TrendingUp,
            title: "Plan ahead with less friction",
            description:
              "Build future phases without needing to archive what you are currently using.",
          },
          {
            icon: Sparkles,
            title: "Use advanced planning limits",
            description:
              "MuscleMetric Pro gives you more room to train seriously and structure better.",
          },
        ],
      };

    case "deep_analytics":
      return {
        eyebrow: "MuscleMetric Pro",
        title: "Unlock Advanced Analytics",
        subtitle:
          "Track your progress, improve faster, and train smarter with premium insights.",
        metricLabel: "Volume (lbs)",
        metricValue: "14,250",
        primaryCta: "Start Free Trial",
        pricingLine: "£2.99/month or £31.99/year (Save 10%)",
        benefits: [
          {
            icon: TrendingUp,
            title: "Track strength and progress over time",
            description:
              "Visualise changes in performance and spot improvement trends faster.",
          },
          {
            icon: LineChart,
            title: "Get deeper insights into your workouts",
            description:
              "Go beyond basic history with premium progress views and richer breakdowns.",
          },
          {
            icon: CalendarPlus,
            title: "Create more plans, templates, and goals",
            description:
              "Unlock expanded limits so your training setup can grow with you.",
          },
          {
            icon: Sparkles,
            title: "Build smarter training plans",
            description:
              "Use premium planning features and advanced surfaces designed for long-term progress.",
          },
        ],
      };

    case "generic":
    default:
      return {
        eyebrow: "MuscleMetric Pro",
        title: "Unlock More With Pro",
        subtitle:
          "Get deeper insights, advanced planning, and expanded limits as your training grows.",
        metricLabel: "Pro unlock",
        metricValue: "Active",
        primaryCta: "Start Free Trial",
        pricingLine: "£2.99/month or £31.99/year (Save 10%)",
        benefits: [
          {
            icon: TrendingUp,
            title: "See deeper analytics",
            description:
              "Understand your training progress more clearly with premium insights.",
          },
          {
            icon: CalendarPlus,
            title: "Use expanded planning limits",
            description:
              "Create more plans, templates, and goals without hitting free restrictions.",
          },
          {
            icon: Sparkles,
            title: "Train with better structure",
            description:
              "Build a setup that supports long-term progress instead of patching things together.",
          },
        ],
      };
  }
}

export default function PaywallContent({
  reason,
  onStartTrial,
  onRestorePurchases,
  onClose,
}: PaywallContentProps) {
  const content = useMemo(() => getContent(reason), [reason]);

  return (
    <ScrollView
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.brand}>MUSCLEMETRIC</Text>
      </View>

      <View style={styles.hero}>
        {!!content.eyebrow && <Text style={styles.eyebrow}>{content.eyebrow}</Text>}
        <Text style={styles.title}>{content.title}</Text>
        <Text style={styles.subtitle}>{content.subtitle}</Text>
      </View>

      <View style={styles.visualCard}>
        <View style={styles.visualGlowA} />
        <View style={styles.visualGlowB} />

        <View style={styles.visualFooter}>
          <View>
            <Text style={styles.metricLabel}>{content.metricLabel}</Text>
            <Text style={styles.metricValue}>{content.metricValue}</Text>
          </View>

          <View style={styles.proBadge}>
            <Sparkles size={14} color="#D9E3FF" />
            <Text style={styles.proBadgeText}>PRO</Text>
          </View>
        </View>
      </View>

      <View style={styles.benefits}>
        {content.benefits.map((benefit, idx) => (
          <PaywallBenefitItem
            key={`${benefit.title}-${idx}`}
            icon={benefit.icon}
            title={benefit.title}
            description={benefit.description}
          />
        ))}
      </View>

      <View style={styles.pricingWrap}>
        <View style={styles.trialPill}>
          <Text style={styles.trialPillText}>START 14-DAY FREE TRIAL</Text>
        </View>

        <Text style={styles.priceLine}>{content.pricingLine}</Text>

        <Pressable style={styles.primaryButton} onPress={onStartTrial}>
          <Text style={styles.primaryButtonText}>{content.primaryCta}</Text>
        </Pressable>

        <View style={styles.secondaryActions}>
          <Pressable onPress={onRestorePurchases}>
            <Text style={styles.secondaryActionText}>Restore purchases</Text>
          </Pressable>

          <Pressable onPress={onClose}>
            <Text style={styles.secondaryActionText}>Not now</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.trustRow}>
        <View style={styles.trustItem}>
          <ShieldCheck size={15} color="#AAB6D6" />
          <Text style={styles.trustText}>CANCEL ANYTIME</Text>
        </View>

        <View style={styles.trustItem}>
          <CalendarCheck2 size={15} color="#AAB6D6" />
          <Text style={styles.trustText}>NO CHARGE UNTIL TRIAL ENDS</Text>
        </View>
      </View>

      <Text style={styles.legalText}>
        Subscription automatically renews unless turned off in your account
        settings at least 24 hours before the current period ends. By tapping
        “Start Free Trial”, you agree to the applicable terms.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  contentContainer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 40,
    backgroundColor: "#081120",
  },
  header: {
    alignItems: "center",
    marginBottom: 18,
  },
  brand: {
    color: "#F2F5FF",
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  hero: {
    alignItems: "center",
    marginBottom: 24,
  },
  eyebrow: {
    color: "#A9B8E2",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.4,
    marginBottom: 10,
  },
  title: {
    color: "#F4F7FF",
    fontSize: 38,
    fontWeight: "900",
    lineHeight: 42,
    textAlign: "center",
    letterSpacing: -1.2,
  },
  subtitle: {
    marginTop: 14,
    color: "#C2CBE0",
    fontSize: 19,
    lineHeight: 28,
    textAlign: "center",
    fontWeight: "500",
  },
  visualCard: {
    height: 200,
    borderRadius: 24,
    backgroundColor: "#10192B",
    overflow: "hidden",
    marginBottom: 18,
    padding: 22,
    justifyContent: "flex-end",
  },
  visualGlowA: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 999,
    backgroundColor: "rgba(85, 132, 255, 0.22)",
    top: -40,
    right: -30,
  },
  visualGlowB: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 999,
    backgroundColor: "rgba(180, 197, 255, 0.10)",
    bottom: -120,
    left: -80,
  },
  visualFooter: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  metricLabel: {
    color: "#C7D3F8",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.1,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  metricValue: {
    color: "#F3F6FF",
    fontSize: 40,
    fontWeight: "900",
    letterSpacing: -1.4,
  },
  proBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(180, 197, 255, 0.18)",
    borderColor: "rgba(180, 197, 255, 0.28)",
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
  },
  proBadgeText: {
    color: "#D9E3FF",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  benefits: {
    gap: 14,
    marginBottom: 24,
  },
  pricingWrap: {
    alignItems: "center",
    marginTop: 6,
  },
  trialPill: {
    backgroundColor: "#1B2640",
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginBottom: 14,
  },
  trialPillText: {
    color: "#D5DFFF",
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 1.1,
  },
  priceLine: {
    color: "#E6EBFB",
    fontSize: 17,
    lineHeight: 24,
    textAlign: "center",
    marginBottom: 18,
    fontWeight: "600",
  },
  primaryButton: {
    width: "100%",
    minHeight: 60,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#5C8DFF",
    marginBottom: 16,
    shadowColor: "#000",
    shadowOpacity: 0.28,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  primaryButtonText: {
    color: "#081120",
    fontSize: 21,
    fontWeight: "900",
    letterSpacing: -0.4,
  },
  secondaryActions: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "center",
    gap: 28,
  },
  secondaryActionText: {
    color: "#C4CDE4",
    fontSize: 15,
    fontWeight: "600",
  },
  trustRow: {
    marginTop: 28,
    borderTopWidth: 1,
    borderTopColor: "rgba(172, 184, 214, 0.10)",
    paddingTop: 22,
    gap: 16,
    alignItems: "center",
  },
  trustItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  trustText: {
    color: "#AAB6D6",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.3,
  },
  legalText: {
    marginTop: 26,
    color: "rgba(170, 182, 214, 0.50)",
    fontSize: 11,
    lineHeight: 18,
    textAlign: "center",
  },
});