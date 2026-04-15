import React, { useMemo } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
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
import { useAppTheme } from "@/lib/useAppTheme";

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
  purchaseDisabled?: boolean;
  purchaseStatusText?: string | null;
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
        pricingLine: "£2.99/month or £29.99/year (Save 10%)",
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
        pricingLine: "£2.99/month or £29.99/year (Save 10%)",
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
        pricingLine: "£2.99/month or £29.99/year (Save 10%)",
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
        metricLabel: "Volume (kgs)",
        metricValue: "14,250",
        primaryCta: "Start Free Trial",
        pricingLine: "£2.99/month or £29.99/year (Save 10%)",
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
        pricingLine: "£2.99/month or £29.99/year (Save 10%)",
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
  purchaseDisabled = false,
  purchaseStatusText = null,
}: PaywallContentProps) {
  const { scheme, colors, typography, layout } = useAppTheme();
  const content = useMemo(() => getContent(reason), [reason]);

  return (
    <ScrollView
      contentContainerStyle={[
        styles.contentContainer,
        {
          backgroundColor: colors.bg,
          paddingHorizontal: layout.space.lg,
          paddingTop: layout.space.sm,
          paddingBottom: layout.space.xxl + layout.space.sm,
        },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View
        style={[
          styles.header,
          {
            marginBottom: layout.space.lg,
          },
        ]}
      >
        <Text
          style={[
            styles.brand,
            {
              color: colors.text,
              fontSize: typography.size.h1 + 4,
              lineHeight: typography.lineHeight.h1 + 4,
              fontFamily: typography.fontFamily.bold,
            },
          ]}
        >
          MUSCLEMETRIC
        </Text>
      </View>

      <View
        style={[
          styles.hero,
          {
            marginBottom: layout.space.xl,
          },
        ]}
      >
        {!!content.eyebrow && (
          <Text
            style={[
              styles.eyebrow,
              {
                color: colors.textMuted,
                fontSize: typography.size.meta,
                lineHeight: typography.lineHeight.meta,
                fontFamily: typography.fontFamily.bold,
                marginBottom: layout.space.sm,
              },
            ]}
          >
            {content.eyebrow}
          </Text>
        )}

        <Text
          style={[
            styles.title,
            {
              color: colors.text,
              fontSize: typography.size.hero,
              lineHeight: typography.lineHeight.hero,
              fontFamily: typography.fontFamily.bold,
            },
          ]}
        >
          {content.title}
        </Text>

        <Text
          style={[
            styles.subtitle,
            {
              color: colors.textMuted,
              fontSize: typography.size.h3 + 1,
              lineHeight: typography.lineHeight.h3 + 4,
              fontFamily: typography.fontFamily.medium,
              marginTop: layout.space.md,
            },
          ]}
        >
          {content.subtitle}
        </Text>
      </View>

      <View
        style={[
          styles.visualCard,
          {
            backgroundColor: colors.surface,
            borderRadius: layout.radius.xl + 2,
            marginBottom: layout.space.lg,
            padding: layout.space.xl,
          },
        ]}
      >
        <View
          style={[
            styles.visualGlowA,
            {
              backgroundColor:
                scheme === "dark"
                  ? "rgba(37,99,235,0.22)"
                  : "rgba(37,99,235,0.14)",
            },
          ]}
        />
        <View
          style={[
            styles.visualGlowB,
            {
              backgroundColor:
                scheme === "dark"
                  ? "rgba(37,99,235,0.10)"
                  : "rgba(37,99,235,0.08)",
            },
          ]}
        />

        <View style={styles.visualFooter}>
          <View>
            <Text
              style={[
                styles.metricLabel,
                {
                  color: colors.primary,
                  fontSize: typography.size.meta - 1,
                  lineHeight: typography.lineHeight.meta,
                  fontFamily: typography.fontFamily.bold,
                  marginBottom: 6,
                },
              ]}
            >
              {content.metricLabel}
            </Text>

            <Text
              style={[
                styles.metricValue,
                {
                  color: colors.text,
                  fontSize: typography.size.hero + 4,
                  lineHeight: typography.lineHeight.hero + 2,
                  fontFamily: typography.fontFamily.bold,
                },
              ]}
            >
              {content.metricValue}
            </Text>
          </View>

          <View
            style={[
              styles.proBadge,
              {
                backgroundColor: colors.cardPressed,
                borderColor: colors.trackBorder,
                borderRadius: layout.radius.pill,
              },
            ]}
          >
            <Sparkles size={14} color={colors.primary} />
            <Text
              style={[
                styles.proBadgeText,
                {
                  color: colors.primary,
                  fontSize: typography.size.meta,
                  lineHeight: typography.lineHeight.meta,
                  fontFamily: typography.fontFamily.bold,
                },
              ]}
            >
              PRO
            </Text>
          </View>
        </View>
      </View>

      <View
        style={[
          styles.benefits,
          {
            gap: layout.space.md,
            marginBottom: layout.space.xl,
          },
        ]}
      >
        {content.benefits.map((benefit, idx) => (
          <PaywallBenefitItem
            key={`${benefit.title}-${idx}`}
            icon={benefit.icon}
            title={benefit.title}
            description={benefit.description}
          />
        ))}
      </View>

      <View
        style={[
          styles.pricingWrap,
          {
            marginTop: layout.space.xs,
          },
        ]}
      >
        <View
          style={[
            styles.trialPill,
            {
              backgroundColor: colors.trackBg,
              borderRadius: layout.radius.pill,
              paddingHorizontal: layout.space.lg + 2,
              paddingVertical: layout.space.sm,
              marginBottom: layout.space.md,
            },
          ]}
        >
          <Text
            style={[
              styles.trialPillText,
              {
                color: colors.primary,
                fontSize: typography.size.meta + 1,
                lineHeight: typography.lineHeight.meta,
                fontFamily: typography.fontFamily.bold,
              },
            ]}
          >
            START 14-DAY FREE TRIAL
          </Text>
        </View>

        <Text
          style={[
            styles.priceLine,
            {
              color: colors.text,
              fontSize: typography.size.body + 1,
              lineHeight: typography.lineHeight.body,
              fontFamily: typography.fontFamily.medium,
              marginBottom: layout.space.lg,
            },
          ]}
        >
          {content.pricingLine}
        </Text>

        {purchaseStatusText ? (
          <Text
            style={[
              styles.statusText,
              {
                color: colors.textMuted,
                fontSize: typography.size.meta,
                lineHeight: typography.lineHeight.meta + 2,
                fontFamily: typography.fontFamily.medium,
                marginBottom: layout.space.md,
              },
            ]}
          >
            {purchaseStatusText}
          </Text>
        ) : null}

        <Pressable
          style={[
            styles.primaryButton,
            {
              backgroundColor: colors.primary,
              borderRadius: layout.radius.xl,
              marginBottom: layout.space.md,
            },
            purchaseDisabled ? styles.primaryButtonDisabled : null,
          ]}
          onPress={onStartTrial}
          disabled={purchaseDisabled}
        >
          <Text
            style={[
              styles.primaryButtonText,
              {
                color: colors.onPrimary,
                fontSize: typography.size.h2,
                lineHeight: typography.lineHeight.h2,
                fontFamily: typography.fontFamily.bold,
              },
              purchaseDisabled ? styles.primaryButtonTextDisabled : null,
            ]}
          >
            {content.primaryCta}
          </Text>
        </Pressable>

        <View
          style={[
            styles.secondaryActions,
            {
              gap: layout.space.xl,
            },
          ]}
        >
          <Pressable onPress={onRestorePurchases}>
            <Text
              style={[
                styles.secondaryActionText,
                {
                  color: colors.textMuted,
                  fontSize: typography.size.sub,
                  lineHeight: typography.lineHeight.sub,
                  fontFamily: typography.fontFamily.medium,
                },
              ]}
            >
              Restore purchases
            </Text>
          </Pressable>

          <Pressable onPress={onClose}>
            <Text
              style={[
                styles.secondaryActionText,
                {
                  color: colors.textMuted,
                  fontSize: typography.size.sub,
                  lineHeight: typography.lineHeight.sub,
                  fontFamily: typography.fontFamily.medium,
                },
              ]}
            >
              Not now
            </Text>
          </Pressable>
        </View>
      </View>

      <View
        style={[
          styles.trustRow,
          {
            marginTop: layout.space.xl + layout.space.xs,
            borderTopColor: colors.border,
            paddingTop: layout.space.lg + 4,
            gap: layout.space.md,
          },
        ]}
      >
        <View style={styles.trustItem}>
          <ShieldCheck size={15} color={colors.textMuted} />
          <Text
            style={[
              styles.trustText,
              {
                color: colors.textMuted,
                fontSize: typography.size.meta,
                lineHeight: typography.lineHeight.meta,
                fontFamily: typography.fontFamily.bold,
              },
            ]}
          >
            CANCEL ANYTIME
          </Text>
        </View>

        <View style={styles.trustItem}>
          <CalendarCheck2 size={15} color={colors.textMuted} />
          <Text
            style={[
              styles.trustText,
              {
                color: colors.textMuted,
                fontSize: typography.size.meta,
                lineHeight: typography.lineHeight.meta,
                fontFamily: typography.fontFamily.bold,
              },
            ]}
          >
            NO CHARGE UNTIL TRIAL ENDS
          </Text>
        </View>
      </View>

      <Text
        style={[
          styles.legalText,
          {
            color: colors.textMuted,
            fontSize: typography.size.meta - 1,
            lineHeight: typography.lineHeight.meta + 2,
            fontFamily: typography.fontFamily.regular,
            marginTop: layout.space.xl,
          },
        ]}
      >
        Subscription automatically renews unless turned off in your account
        settings at least 24 hours before the current period ends. By tapping
        “Start Free Trial”, you agree to the applicable terms.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  contentContainer: {},
  header: {
    alignItems: "center",
  },
  brand: {
    letterSpacing: 0.8,
  },
  hero: {
    alignItems: "center",
  },
  eyebrow: {
    letterSpacing: 1.4,
    textTransform: "uppercase",
    textAlign: "center",
  },
  title: {
    textAlign: "center",
    letterSpacing: -1.2,
  },
  subtitle: {
    textAlign: "center",
  },
  visualCard: {
    height: 200,
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  visualGlowA: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 999,
    top: -40,
    right: -30,
  },
  visualGlowB: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 999,
    bottom: -120,
    left: -80,
  },
  visualFooter: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  metricLabel: {
    textTransform: "uppercase",
    letterSpacing: 1.1,
  },
  metricValue: {
    letterSpacing: -1.4,
  },
  proBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  proBadgeText: {
    letterSpacing: 1.2,
  },
  benefits: {},
  pricingWrap: {
    alignItems: "center",
  },
  trialPill: {},
  trialPillText: {
    letterSpacing: 1.1,
  },
  priceLine: {
    textAlign: "center",
  },
  statusText: {
    textAlign: "center",
  },
  primaryButton: {
    width: "100%",
    minHeight: 60,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.28,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  primaryButtonDisabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    letterSpacing: -0.4,
  },
  primaryButtonTextDisabled: {
    opacity: 0.85,
  },
  secondaryActions: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "center",
  },
  secondaryActionText: {},
  trustRow: {
    borderTopWidth: 1,
    alignItems: "center",
  },
  trustItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  trustText: {
    letterSpacing: 1.3,
  },
  legalText: {
    textAlign: "center",
  },
});