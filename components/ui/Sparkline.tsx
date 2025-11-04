import React from "react";
import { View } from "react-native";
import Svg, { Polyline } from "react-native-svg";

export function Sparkline({ data, height = 70, stroke = "#93c5fd", padding = 8 }:{
  data: number[]; height?: number; stroke?: string; padding?: number;
}) {
  const [w, setW] = React.useState(0);
  const width = Math.max(160, w);

  const points = React.useMemo(() => {
    if (!data?.length || width <= 0) return "";
    const max = Math.max(...data, 1), min = Math.min(...data, 0);
    const span = Math.max(1, max - min), n = data.length;
    return data.map((v,i)=>{
      const x = padding + (i*(width - padding*2))/Math.max(1,n-1);
      const y = height - padding - ((v-min)/span)*(height - padding*2);
      return `${x},${y}`;
    }).join(" ");
  }, [data, height, padding, width]);

  return (
    <View onLayout={e=>setW(e.nativeEvent.layout.width)} style={{ width: "100%" }}>
      <Svg width={width} height={height}>
        <Polyline points={points} fill="none" stroke={stroke} strokeWidth={3} />
      </Svg>
    </View>
  );
}
