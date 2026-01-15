// app/features/workouts/live/components/LiveStickyFooter.tsx
import React from "react";
import { StickyFooter, Button } from "@/ui";

export function LiveStickyFooter({
  onComplete,
  disabled,
}: {
  onComplete: () => void;
  disabled?: boolean;
}) {
  return (
    <StickyFooter>
      <Button title="Complete workout" onPress={onComplete} disabled={!!disabled} />
    </StickyFooter>
  );
}
