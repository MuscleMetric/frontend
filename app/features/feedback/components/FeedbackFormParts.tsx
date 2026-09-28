import React from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { useAppTheme } from "@/lib/useAppTheme";
import { Icon, type IconName } from "@/ui/icons/Icon";

export type ChoiceOption = {
  value: string;
  label: string;
};

export function FeedbackFormContainer({ children }: { children: React.ReactNode }) {
  const { colors, layout } = useAppTheme();

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{
        padding: layout.space.lg,
        paddingBottom: layout.space.xxl,
        gap: layout.space.lg,
        backgroundColor: colors.bg,
      }}
    >
      {children}
    </ScrollView>
  );
}

export function FeedbackHeader({
  icon,
  title,
  description,
  tone = "primary",
}: {
  icon: IconName;
  title: string;
  description: string;
  tone?: "primary" | "success" | "warning" | "danger";
}) {
  const { colors, typography, layout } = useAppTheme();
  const toneColor = colors[tone];

  return (
    <View style={{ flexDirection: "row", gap: layout.space.md, alignItems: "center" }}>
      <View
        style={{
          width: 52,
          height: 52,
          borderRadius: layout.radius.lg,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: `${toneColor}22`,
        }}
      >
        <Icon name={icon} size={26} color={toneColor} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text
          style={{
            color: colors.text,
            fontFamily: typography.fontFamily.bold,
            fontSize: typography.size.h2,
            lineHeight: typography.lineHeight.h2,
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
          {description}
        </Text>
      </View>
    </View>
  );
}

export function FormSection({
  label,
  optional = false,
  children,
}: {
  label: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  const { colors, typography } = useAppTheme();

  return (
    <View style={{ gap: 8 }}>
      <Text
        style={{
          color: colors.text,
          fontFamily: typography.fontFamily.semibold,
          fontSize: typography.size.sub,
          lineHeight: typography.lineHeight.sub,
        }}
      >
        {label}
        {optional ? (
          <Text style={{ color: colors.textMuted, fontFamily: typography.fontFamily.regular }}>
            {" "}(optional)
          </Text>
        ) : null}
      </Text>
      {children}
    </View>
  );
}

export function ChoiceChips({
  options,
  value,
  onChange,
}: {
  options: readonly ChoiceOption[];
  value?: string;
  onChange: (value: string) => void;
}) {
  const { colors, typography, layout } = useAppTheme();

  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: layout.space.sm }}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => ({
              minHeight: 42,
              paddingHorizontal: 14,
              borderRadius: layout.radius.pill,
              borderWidth: 1,
              borderColor: selected ? colors.primary : colors.border,
              backgroundColor: selected ? colors.cardPressed : colors.surface,
              alignItems: "center",
              justifyContent: "center",
              opacity: pressed ? 0.88 : 1,
            })}
          >
            <Text
              style={{
                color: selected ? colors.primary : colors.text,
                fontFamily: selected
                  ? typography.fontFamily.semibold
                  : typography.fontFamily.medium,
                fontSize: typography.size.sub,
              }}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function FeedbackTextArea({
  value,
  onChangeText,
  placeholder,
  maxLength = 500,
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  maxLength?: number;
}) {
  const { colors, typography, layout } = useAppTheme();

  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: layout.radius.lg,
        backgroundColor: colors.surface,
        padding: layout.space.md,
        gap: 8,
      }}
    >
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        multiline
        maxLength={maxLength}
        textAlignVertical="top"
        style={{
          minHeight: 104,
          color: colors.text,
          fontFamily: typography.fontFamily.regular,
          fontSize: typography.size.body,
          lineHeight: typography.lineHeight.body,
        }}
      />
      <Text
        style={{
          alignSelf: "flex-end",
          color: colors.textMuted,
          fontFamily: typography.fontFamily.regular,
          fontSize: typography.size.meta,
        }}
      >
        {value.length}/{maxLength}
      </Text>
    </View>
  );
}

export function StarRating({
  value,
  onChange,
}: {
  value: number;
  onChange: (rating: number) => void;
}) {
  const { colors, layout, typography } = useAppTheme();

  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: layout.radius.xl,
        backgroundColor: colors.surface,
        padding: layout.space.lg,
        gap: layout.space.sm,
        alignItems: "center",
      }}
    >
      <View style={{ flexDirection: "row", gap: layout.space.sm }}>
        {[1, 2, 3, 4, 5].map((rating) => (
          <Pressable
            key={rating}
            onPress={() => onChange(rating)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`${rating} star${rating === 1 ? "" : "s"}`}
          >
            <Icon
              name={rating <= value ? "star" : "star-outline"}
              size={38}
              color={rating <= value ? colors.warning : colors.textMuted}
            />
          </Pressable>
        ))}
      </View>
      <Text
        style={{
          color: colors.textMuted,
          fontFamily: typography.fontFamily.medium,
          fontSize: typography.size.sub,
        }}
      >
        {value ? `${value} out of 5 stars` : "Tap a star to rate MuscleMetric"}
      </Text>
    </View>
  );
}

export function FeedbackError({ message }: { message?: string | null }) {
  const { colors, typography } = useAppTheme();
  if (!message) return null;

  return (
    <Text
      style={{
        color: colors.danger,
        fontFamily: typography.fontFamily.medium,
        fontSize: typography.size.sub,
      }}
    >
      {message}
    </Text>
  );
}

export function FeedbackSuccess({ message }: { message: string }) {
  const { colors, typography, layout } = useAppTheme();

  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        gap: layout.space.md,
        padding: layout.space.xxl,
        backgroundColor: colors.bg,
      }}
    >
      <View
        style={{
          width: 72,
          height: 72,
          borderRadius: layout.radius.pill,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.successBg,
        }}
      >
        <Icon name="checkmark" size={38} color={colors.success} />
      </View>
      <Text
        style={{
          color: colors.text,
          fontFamily: typography.fontFamily.bold,
          fontSize: typography.size.h2,
          textAlign: "center",
        }}
      >
        Thanks for your feedback
      </Text>
      <Text
        style={{
          color: colors.textMuted,
          fontFamily: typography.fontFamily.regular,
          fontSize: typography.size.body,
          lineHeight: typography.lineHeight.body,
          textAlign: "center",
        }}
      >
        {message}
      </Text>
    </View>
  );
}
