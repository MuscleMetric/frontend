import React from "react";
import { View, Text, StyleSheet, ActivityIndicator, Pressable } from "react-native";

type PW = { id:string; workout_id:string; title:string|null; exercises:string[]; weekly_complete:boolean|null; is_archived:boolean|null; };

export function NextWorkoutSection({
  colors, loading, hasPlans, activePlanId, nextWorkoutTitle, nextIncompletePW,
  onCreatePlan, onOpenWorkout,
}:{
  colors:any; loading:boolean; hasPlans:boolean; activePlanId:string|null;
  nextWorkoutTitle:string; nextIncompletePW:PW|null;
  onCreatePlan:()=>void; onOpenWorkout:(workoutId:string, planWorkoutId:string)=>void;
}) {
  const s = styles(colors);
  const canOpen = !!activePlanId && !!nextIncompletePW?.workout_id;
  const Container:any = canOpen ? Pressable : View;
  return (
    <Container style={s.card} onPress={canOpen ? ()=>onOpenWorkout(String(nextIncompletePW!.workout_id), String(nextIncompletePW!.id)) : undefined}>
      <Text style={s.title}>NEXT WORKOUT</Text>

      {loading ? <ActivityIndicator/> :
       !hasPlans ? (
        <>
          <Text style={{color: colors.subtle}}>Create a plan to enable Next Workout.</Text>
          <Pressable onPress={onCreatePlan} style={[s.button,{backgroundColor: colors.primary, marginTop:12}]}>
            <Text style={[s.buttonText,{color: colors.background}]}>Create a plan</Text>
          </Pressable>
        </>
       ) : !activePlanId ? (
        <Text style={{color: colors.subtle}}>You have plans but no active plan selected. Pick one in Plans.</Text>
       ) : nextIncompletePW ? (
        <>
          <Text style={[s.nextTitle,{color: colors.successText}]}>{nextWorkoutTitle}</Text>
          <View style={{ height:1, backgroundColor: colors.border, marginVertical:10 }} />
          <Text style={{color: colors.subtle}} numberOfLines={2}>
            {nextIncompletePW.exercises?.length ? nextIncompletePW.exercises.join(" • ") : "No exercises"}
          </Text>
        </>
       ) : (
        <Text style={{color: colors.subtle}}>All workouts completed this week.</Text>
       )}
    </Container>
  );
}

const styles = (colors:any)=>StyleSheet.create({
  card:{ backgroundColor: colors.card, padding:16, borderRadius:16, borderWidth:StyleSheet.hairlineWidth, borderColor:colors.border },
  title:{ color: colors.subtle, fontSize:14, fontWeight:"800", letterSpacing:1, marginBottom:10, textTransform:"uppercase" },
  nextTitle:{ fontSize:24, fontWeight:"900" },
  button:{ paddingVertical:12, paddingHorizontal:14, borderRadius:12, alignSelf:"flex-start" },
  buttonText:{ fontWeight:"800", fontSize:14 },
});
