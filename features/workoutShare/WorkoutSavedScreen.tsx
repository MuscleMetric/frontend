import React from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Check, Share2 } from "lucide-react-native";
import { Button } from "@/ui/buttons/Button";
import { useAppTheme } from "@/lib/useAppTheme";

type Props = { title: string; sets: number; exercises: number; onShare: () => void; onSkip: () => void };
export default function WorkoutSavedScreen({ title, sets, exercises, onShare, onSkip }: Props) {
  const { colors, typography, layout } = useAppTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: layout.space.lg, gap: layout.space.lg, width: "100%", maxWidth: 560, alignSelf: "center" }}>
        <View style={{ alignItems: "center", gap: layout.space.md }}>
          <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.successBg, alignItems: "center", justifyContent: "center" }}><Check color={colors.success} size={36} /></View>
          <Text style={{ color: colors.success, fontFamily: typography.fontFamily.semibold, fontSize: typography.size.sub }}>Workout saved</Text>
          <Text style={{ color: colors.text, fontFamily: typography.fontFamily.bold, fontSize: typography.size.h1, textAlign: "center" }}>You showed up. Share the effort.</Text>
          <Text style={{ color: colors.textMuted, fontFamily: typography.fontFamily.regular, fontSize: typography.size.body, lineHeight: typography.lineHeight.body, textAlign: "center" }}>Turn today’s session into a workout post. Your workout is already selected—just add a caption and choose who can see it.</Text>
        </View>
        <View style={{ padding: layout.space.lg, gap: layout.space.sm, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: layout.radius.xl }}>
          <Text style={{ color: colors.textMuted, fontFamily: typography.fontFamily.medium }}>YOUR SESSION</Text>
          <Text style={{ color: colors.text, fontFamily: typography.fontFamily.bold, fontSize: typography.size.h2 }}>{title}</Text>
          <Text style={{ color: colors.textMuted, fontFamily: typography.fontFamily.regular }}>{exercises} exercises · {sets} completed sets</Text>
        </View>
        <Button title="Create post" leftIcon={<Share2 color="#FFFFFF" size={20} />} onPress={onShare} />
        <Button title="Not now" variant="secondary" onPress={onSkip} />
        <Text style={{ color: colors.textMuted, fontFamily: typography.fontFamily.regular, fontSize: typography.size.meta, textAlign: "center" }}>Nothing is posted until you tap Post. You can also share later from Social.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}
