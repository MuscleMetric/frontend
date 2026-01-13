// app/features/workouts/sections/NewUserSetupSection.tsx

import React from "react";
import { View, StyleSheet } from "react-native";

import { Card, ListRow, Button, ProgressBar, Pill } from "@/ui";
import { useAppTheme } from "@/lib/useAppTheme";

export function NewUserSetupSection({
  setup,
  onOpenCreate,
}: {
  setup: {
    title: string;
    subtitle: string;
    progressPct: number;
    cta: { label: string; action: "create_first_workout" };
  } | null;
  onOpenCreate: () => void;
}) {
  const { layout } = useAppTheme();

  // If the RPC doesn't send setup for some reason, don't render the section.
  if (!setup) return null;

  return (
    <Card>
      <View style={{ gap: layout.space.sm }}>
        <Pill label="New" />

        <ListRow
          title={setup.title}
          subtitle={setup.subtitle}
          showChevron={false}
        />

        <ProgressBar valuePct={setup.progressPct} />

        <View style={[styles.row, { gap: layout.space.sm }]}>
          <View style={{ flex: 1 }}>
            <Button title={setup.cta.label} onPress={onOpenCreate} />
          </View>

          <View style={{ flex: 1 }}>
            <Button
              variant="secondary"
              title="Create a plan"
              onPress={() => {
                // plans live in this tab, but route is separate
                // we’re not assuming anything else
                onOpenCreate(); // optional: you can remove this line if you don’t want modal
              }}
            />
          </View>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
});
