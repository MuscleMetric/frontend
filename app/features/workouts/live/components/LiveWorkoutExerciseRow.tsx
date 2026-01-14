import React from "react";
import { Pressable, View, Text } from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";
import { Card, Icon } from "@/ui";

export function LiveWorkoutExerciseRow({
  title,
  subtitle,
  isDone,
  onPress,
  onToggleDone,
}: {
  title: string;
  subtitle: string;
  isDone: boolean;
  onPress: () => void;
  onToggleDone: () => void;
}) {
  const { colors, typography, layout } = useAppTheme();

  return (
    <Pressable onPress={onPress}>
      <Card>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontFamily: typography.fontFamily.semibold,
                fontSize: typography.size.body,
                color: colors.text,
                textDecorationLine: isDone ? "line-through" : "none",
              }}
              numberOfLines={1}
            >
              {title}
            </Text>
            <Text
              style={{
                marginTop: 2,
                fontFamily: typography.fontFamily.regular,
                fontSize: typography.size.sub,
                color: colors.textMuted,
              }}
              numberOfLines={1}
            >
              {subtitle}
            </Text>
          </View>

          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              onToggleDone();
            }}
            style={{ padding: 10, marginLeft: layout.space.sm }}
          >
            {isDone ? (
              <Icon name="checkmark-circle" size={22} color={colors.success} />
            ) : (
              <Icon name="ellipse-outline" size={22} color={colors.textMuted} />
            )}
          </Pressable>
        </View>
      </Card>
    </Pressable>
  );
}
