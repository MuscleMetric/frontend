import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Dimensions, Text, View } from "react-native";

type Piece = {
  id: string;
  x: number;
  size: number;
  duration: number;
  delay: number;
  rotate: Animated.Value;
  fall: Animated.Value;
  opacity: Animated.Value;
  emoji: string;
};

const EMOJIS = ["❄️", "🎄", "🎁", "✨", "☃️", "⭐️", "🦌"];

export function ChristmasConfetti({ active }: { active: boolean }) {
  const { width, height } = Dimensions.get("window");
  const runningRef = useRef(false);

  const pieces = useMemo<Piece[]>(() => {
    const count = 200;
    return Array.from({ length: count }).map((_, i) => {
      const size = 14 + Math.floor(Math.random() * 16);
      return {
        id: String(i),
        x: Math.random() * (width - 30),
        size,
        duration: 2600 + Math.floor(Math.random() * 1900), // slightly slower = snow vibe
        delay: Math.floor(Math.random() * 350),
        rotate: new Animated.Value(0),
        fall: new Animated.Value(-40 - Math.random() * 120),
        opacity: new Animated.Value(0),
        emoji: EMOJIS[Math.floor(Math.random() * EMOJIS.length)],
      };
    });
  }, [width, height]);

  useEffect(() => {
    if (!active) {
      runningRef.current = false;
      return;
    }
    runningRef.current = true;

    const fallAnims: Animated.CompositeAnimation[] = [];
    const rotateAnims: Animated.CompositeAnimation[] = [];

    pieces.forEach((p) => {
      const rot = Animated.loop(
        Animated.timing(p.rotate, {
          toValue: 1,
          duration: 1200 + Math.floor(Math.random() * 900),
          useNativeDriver: true,
        })
      );
      rotateAnims.push(rot);
      rot.start();

      const runFall = () => {
        if (!runningRef.current) return;

        // re-randomize horizontal position each drop
        p.x = Math.random() * (width - 30);

        p.fall.setValue(-80 - Math.random() * 160);
        p.opacity.setValue(0);

        const endY = height + 140 + Math.random() * 200;

        const a = Animated.sequence([
          Animated.delay(p.delay),
          Animated.timing(p.opacity, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(p.fall, {
            toValue: endY,
            duration: p.duration,
            useNativeDriver: true,
          }),
          Animated.timing(p.opacity, {
            toValue: 0,
            duration: 220,
            useNativeDriver: true,
          }),
        ]);

        fallAnims.push(a);

        a.start(() => {
          if (!runningRef.current) return;
          runFall();
        });
      };

      runFall();
    });

    return () => {
      runningRef.current = false;
      fallAnims.forEach((a) => a.stop());
      rotateAnims.forEach((a) => a.stop());
    };
  }, [active, height, pieces, width]);

  if (!active) return null;

  return (
    <View
      pointerEvents="none"
      style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
    >
      {pieces.map((p) => {
        const rotate = p.rotate.interpolate({
          inputRange: [0, 1],
          outputRange: ["0deg", "360deg"],
        });

        return (
          <Animated.View
            key={p.id}
            style={{
              position: "absolute",
              left: p.x,
              transform: [{ translateY: p.fall }, { rotate }],
              opacity: p.opacity,
            }}
          >
            <Text style={{ fontSize: p.size }}>{p.emoji}</Text>
          </Animated.View>
        );
      })}
    </View>
  );
}
