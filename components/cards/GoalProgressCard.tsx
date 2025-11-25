import React from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";

export function GoalProgressCard({ colors, loading, label }:{ colors:any; loading:boolean; label:string; }) {
  const s = styles(colors);
  return (
    <View style={[s.card, s.equal]}>
      <Text style={s.title}>GOAL PROGRESS</Text>
      {loading ? <ActivityIndicator/> : <Text style={s.big} numberOfLines={2}>{label}</Text>}
    </View>
  );
}
const styles = (colors:any)=>StyleSheet.create({
  card:{ width:"48%", backgroundColor: colors.card, padding:16, borderRadius:16, borderWidth:StyleSheet.hairlineWidth, borderColor:colors.border },
  equal:{ minHeight:140, justifyContent:"space-between" },
  title:{ color: colors.subtle, fontSize:14, fontWeight:"800", letterSpacing:1, marginBottom:10, textTransform:"uppercase" },
  big:{ color: "white", fontSize:18, fontWeight:"800", lineHeight:22 }, // text color will be overridden by theme at callsite if needed
});
