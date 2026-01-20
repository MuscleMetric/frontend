// live/modals/sections/SupersetSwitcher.tsx
import React, { useMemo } from "react";
import { View, Text, Pressable } from "react-native";
import type { LiveWorkoutDraft } from "../../state/types";

function supersetLetterForGroup(draft: LiveWorkoutDraft, group: string) {
  const groups = Array.from(
    new Set(
      draft.exercises
        .map((e) => e.prescription?.supersetGroup)
        .filter((g): g is string => !!g && g.trim().length > 0)
    )
  ).sort((a, b) => a.localeCompare(b));

  const at = groups.indexOf(group);
  const letter = String.fromCharCode("A".charCodeAt(0) + Math.max(0, at % 26));
  return letter;
}

export function SupersetSwitcher(props: {
  draft: LiveWorkoutDraft;
  activeExerciseIndex: number;
  colors: any;
  typography: any;
  supersetGroup: string;
  onJumpToExercise?: (exerciseIndex: number) => void;
}) {
  const { draft, supersetGroup, colors, typography } = props;

  const groupExercises = useMemo(() => {
    return draft.exercises
      .map((e, i) => ({ e, i }))
      .filter(({ e }) => e.prescription?.supersetGroup === supersetGroup)
      .sort(
        (a, b) =>
          (a.e.prescription?.supersetIndex ?? 0) - (b.e.prescription?.supersetIndex ?? 0)
      );
  }, [draft.exercises, supersetGroup]);

  if (groupExercises.length < 2) return null;

  const letter = supersetLetterForGroup(draft, supersetGroup);

  return (
    <View style={{ paddingHorizontal: 16, paddingTop: 10 }}>
      <View
        style={{
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface ?? colors.bg,
          borderRadius: 18,
          padding: 6,
          flexDirection: "row",
          gap: 6,
        }}
      >
        {groupExercises.slice(0, 3).map(({ e, i }, k) => {
          const tag = `${letter}${k + 1}`;
          const active = i === props.activeExerciseIndex;

          return (
            <Pressable
              key={`${i}`}
              onPress={() => props.onJumpToExercise?.(i)}
              style={{
                flex: 1,
                paddingVertical: 10,
                borderRadius: 14,
                backgroundColor: active ? colors.primary : "transparent",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text
                style={{
                  color: active ? "#fff" : colors.textMuted,
                  fontFamily: typography.fontFamily.semibold,
                  fontSize: 13,
                }}
                numberOfLines={1}
              >
                {tag} {e.name}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
