import React from "react";
import type { ShareTemplateId, ShareWorkoutData } from "./workoutShare";

import { BlackShareCard } from "./templates/black";
import { TransparentShareCard } from "./templates/transparent";

export function WorkoutShareCard({
  template,
  data,
  width = 1080,
  height = 1920,
}: {
  template: ShareTemplateId;
  data: ShareWorkoutData;
  width?: number;
 height?: number;
}) {
  switch (template) {
    case "transparent":
      return (
        <TransparentShareCard
          data={data}
          width={width}
          height={height}
        />
      );

    case "black":
    default:
      return (
        <BlackShareCard
          data={data}
          width={width}
          height={height}
        />
      );
  }
}