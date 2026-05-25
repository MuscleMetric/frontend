import React, { useCallback, useMemo } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Linking,
  Alert,
  useWindowDimensions,
} from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";

type Source = {
  title: string;
  organisation: string;
  url: string;
  description: string;
};

const SOURCES: Source[] = [
  {
    title: "Physical activity guidelines for adults",
    organisation: "NHS",
    url: "https://www.nhs.uk/live-well/exercise/physical-activity-guidelines-for-adults-aged-19-to-64/",
    description: "General adult physical activity guidance.",
  },
  {
    title: "Physical activity fact sheet",
    organisation: "World Health Organization",
    url: "https://www.who.int/news-room/fact-sheets/detail/physical-activity",
    description: "Global public health information about physical activity.",
  },
  {
    title: "Adult Physical Activity Basics",
    organisation: "CDC",
    url: "https://www.cdc.gov/physical-activity-basics/guidelines/adults.html",
    description: "Adult physical activity guidance and context.",
  },
  {
    title: "Progression Models in Resistance Training for Healthy Adults",
    organisation: "ACSM",
    url: "https://pubmed.ncbi.nlm.nih.gov/19204579/",
    description: "Resistance training progression reference.",
  },
];

function MethodBlock({ title, body }: { title: string; body: string }) {
  const { colors, typography, layout } = useAppTheme();

  return (
    <View
      style={{
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.border,
        backgroundColor: colors.bg,
        borderRadius: layout.radius.lg,
        padding: layout.space.md,
        gap: 4,
      }}
    >
      <Text
        style={{
          color: colors.text,
          fontFamily: typography.fontFamily.semibold,
          fontSize: typography.size.body,
          lineHeight: typography.lineHeight.body,
        }}
      >
        {title}
      </Text>

      <Text
        style={{
          color: colors.textMuted,
          fontFamily: typography.fontFamily.regular,
          fontSize: typography.size.sub,
          lineHeight: typography.lineHeight.sub,
        }}
      >
        {body}
      </Text>
    </View>
  );
}

export function SourcesMethodologyModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { height } = useWindowDimensions();
  const { colors, typography, layout } = useAppTheme();

  const modalHeight = Math.max(420, Math.round(height * 0.86));

  const styles = useMemo(
    () =>
      StyleSheet.create({
        backdrop: {
          flex: 1,
          backgroundColor: colors.overlay,
          justifyContent: "center",
          padding: layout.space.lg,
        },

        backdropPressable: {
          ...StyleSheet.absoluteFillObject,
        },

        card: {
          width: "100%",
          maxWidth: 520,
          height: modalHeight,
          alignSelf: "center",
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          borderRadius: layout.radius.lg,
          overflow: "hidden",
          flexDirection: "column",
        },

        header: {
          flexShrink: 0,
          paddingHorizontal: layout.space.lg,
          paddingTop: layout.space.lg,
          paddingBottom: layout.space.md,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
          gap: 4,
        },

        title: {
          color: colors.text,
          fontFamily: typography.fontFamily.bold,
          fontSize: typography.size.h3,
          lineHeight: typography.lineHeight.h3,
        },

        subtitle: {
          color: colors.textMuted,
          fontFamily: typography.fontFamily.regular,
          fontSize: typography.size.sub,
          lineHeight: typography.lineHeight.sub,
        },

        scroll: {
          flex: 1,
          minHeight: 0,
        },

        body: {
          padding: layout.space.lg,
          gap: layout.space.md,
          paddingBottom: layout.space.xl,
        },

        sectionTitle: {
          color: colors.text,
          fontFamily: typography.fontFamily.bold,
          fontSize: typography.size.body,
          lineHeight: typography.lineHeight.body,
          marginTop: 2,
        },

        disclaimer: {
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.warning ?? colors.border,
          backgroundColor: colors.trackBg,
          borderRadius: layout.radius.lg,
          padding: layout.space.md,
        },

        disclaimerText: {
          color: colors.text,
          fontFamily: typography.fontFamily.regular,
          fontSize: typography.size.sub,
          lineHeight: typography.lineHeight.sub,
        },

        sourceRow: {
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          backgroundColor: colors.bg,
          borderRadius: layout.radius.lg,
          padding: layout.space.md,
          gap: 4,
        },

        sourceOrg: {
          color: colors.primary,
          fontFamily: typography.fontFamily.bold,
          fontSize: typography.size.meta,
          textTransform: "uppercase",
          letterSpacing: 0.5,
        },

        sourceTitle: {
          color: colors.text,
          fontFamily: typography.fontFamily.semibold,
          fontSize: typography.size.body,
          lineHeight: typography.lineHeight.body,
        },

        sourceDesc: {
          color: colors.textMuted,
          fontFamily: typography.fontFamily.regular,
          fontSize: typography.size.sub,
          lineHeight: typography.lineHeight.sub,
        },

        footer: {
          flexShrink: 0,
          flexDirection: "row",
          gap: layout.space.sm,
          paddingHorizontal: layout.space.lg,
          paddingTop: layout.space.sm,
          paddingBottom: layout.space.lg,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
        },

        closeBtn: {
          flex: 1,
          minHeight: 44,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.primary,
          borderRadius: layout.radius.md,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: layout.space.md,
        },

        closeBtnText: {
          color: colors.onPrimary,
          fontFamily: typography.fontFamily.semibold,
          fontSize: typography.size.body,
        },
      }),
    [colors, typography, layout, modalHeight],
  );

  const openSource = useCallback(async (url: string) => {
    const ok = await Linking.canOpenURL(url);

    if (!ok) {
      Alert.alert("Can't open link", "Please try again later.");
      return;
    }

    await Linking.openURL(url);
  }, []);

  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      presentationStyle="overFullScreen"
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropPressable} onPress={onClose} />

        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>Sources & Methodology</Text>
            <Text style={styles.subtitle}>
              How MuscleMetric calculates workout summaries and estimated
              values.
            </Text>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.body}
            showsVerticalScrollIndicator
            alwaysBounceVertical
            bounces
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.disclaimer}>
              <Text style={styles.disclaimerText}>
                MuscleMetric provides general workout tracking information only.
                It is not medical advice. If you have pain, injury, illness, or
                medical concerns, speak to a qualified professional.
              </Text>
            </View>

            <Text style={styles.sectionTitle}>Methodology</Text>

            <MethodBlock
              title="Estimated strength"
              body="Estimated strength is calculated from logged weight and reps using a standard estimated one-rep max formula. These values are estimates and may not match a tested max."
            />

            <MethodBlock
              title="Volume"
              body="Volume is calculated from logged weight × reps."
            />

            <MethodBlock
              title="Workout counts"
              body="Workout counts are based on completed workouts logged in MuscleMetric."
            />

            <MethodBlock
              title="Goal charts"
              body="Goal charts show user-entered goal values and logged workout data. They are planning and tracking tools, not medical or training prescriptions."
            />

            <MethodBlock
              title="Plan lines and goal ranges"
              body="Plan lines and goal ranges are generated from values entered by the user and selected plan length. They are editable planning aids."
            />

            <Text style={styles.sectionTitle}>Sources</Text>

            {SOURCES.map((source) => (
              <Pressable
                key={source.url}
                style={({ pressed }) => [
                  styles.sourceRow,
                  { opacity: pressed ? 0.65 : 1 },
                ]}
                onPress={() => openSource(source.url)}
              >
                <Text style={styles.sourceOrg}>{source.organisation}</Text>
                <Text style={styles.sourceTitle}>{source.title}</Text>
                <Text style={styles.sourceDesc}>{source.description}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <View style={styles.footer}>
            <Pressable style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeBtnText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}