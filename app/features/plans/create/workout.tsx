// app/features/plans/create/Workout.tsx
import { useLocalSearchParams, router } from "expo-router";
import { View, Text, TextInput, Pressable, StyleSheet, Alert, ScrollView, ActivityIndicator } from "react-native";
import { usePlanDraft, WorkoutDraft, ExerciseRow } from "./store";
import { useEffect, useState } from "react";
import { supabase } from "../../../../lib/supabase";

export default function WorkoutPage() {
  const { index: idxParam } = useLocalSearchParams<{ index: string }>();
  const index = Number(idxParam ?? 0);
  const { workoutsPerWeek, workouts, setWorkout } = usePlanDraft();
  const draft = workouts[index];

  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ExerciseRow[]>([]);

  useEffect(()=>{        // fetch exercises (simple search)
    let active = true;
    (async ()=>{
      setLoading(true);
      const q = supabase.from("exercises").select("id,name,type").order("popularity",{ascending:false}).limit(25);
      const { data } = search.trim() ? await q.ilike("name", `%${search.trim()}%`) : await q;
      if (active) setResults((data??[]) as any);
      setLoading(false);
    })();
    return ()=>{ active=false; };
  }, [search]);

  if (!draft) {
    // Index out of range → return to PlanInfo
    router.replace("/features/plans/create/planInfo");
    return null;
  }

  function addExercise(ex: ExerciseRow) {
    const exDraft = {
      exercise: ex,
      order_index: draft.exercises.length,
      ...(ex.type === "strength" ? { target_sets: 3, target_reps: 8 } : {}),
      ...(ex.type === "cardio"   ? { target_time_seconds: 20*60 } : {}),
    };
    setWorkout(index, { ...draft, exercises: [...draft.exercises, exDraft] });
  }

  function next() {
    if (!draft.title.trim()) return Alert.alert("Add a workout title");
    if (draft.exercises.length === 0) return Alert.alert("Add at least one exercise");

    if (index < workoutsPerWeek - 1) {
      router.push({ pathname: "/features/plans/create/workout", params: { index: index + 1 } });
    } else {
      router.push("/features/plans/create/goals");
    }
  }

  return (
    <ScrollView style={{ flex:1, backgroundColor:"#F7F8FA" }} contentContainerStyle={{ padding:16 }}>
      <Text style={s.h2}>Workout {index+1} of {workoutsPerWeek}</Text>

      <Text style={s.label}>Title</Text>
      <TextInput style={s.input} value={draft.title} onChangeText={(t)=>setWorkout(index, { ...draft, title: t })} />

      <Text style={s.label}>Exercises</Text>
      {draft.exercises.map((e, i)=>(
        <View key={i} style={s.item}>
          <Text style={{ fontWeight:"700" }}>{i+1}. {e.exercise.name}</Text>
          <Pressable onPress={()=>{
            const copy = [...draft.exercises]; copy.splice(i,1);
            setWorkout(index, { ...draft, exercises: copy.map((x, j)=>({ ...x, order_index: j })) });
          }}>
            <Text style={{ color:"#ef4444" }}>Remove</Text>
          </Pressable>
        </View>
      ))}

      <TextInput style={[s.input, { marginTop:8 }]} placeholder="Search exercises…" value={search} onChangeText={setSearch} />
      {loading ? <ActivityIndicator style={{ marginTop:8 }} /> : (
        <View style={{ gap:8, marginTop:8 }}>
          {results.map(r=>(
            <Pressable key={r.id} style={s.row} onPress={()=>addExercise(r)}>
              <Text>{r.name}</Text>
              <Text style={{ color:"#6b7280" }}>{r.type ?? ""}</Text>
            </Pressable>
          ))}
        </View>
      )}

      <View style={{ flexDirection:"row", gap:12, marginTop:16 }}>
        {index>0 && (
          <Pressable style={s.btn} onPress={()=>router.back()}>
            <Text style={s.btnText}>← Back</Text>
          </Pressable>
        )}
        <Pressable style={[s.btn, s.primary, { flex:1 }]} onPress={next}>
          <Text style={s.primaryText}>{index < workoutsPerWeek-1 ? "Next Workout →" : "Next → Goals"}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  h2:{ fontSize:18, fontWeight:"800", marginBottom:12 },
  label:{ fontWeight:"700", marginTop:12, marginBottom:6 },
  input:{ backgroundColor:"#fff", padding:12, borderRadius:10, borderWidth:StyleSheet.hairlineWidth, borderColor:"#E5E7EB" },
  item:{ backgroundColor:"#F3F4F6", borderRadius:10, padding:10, flexDirection:"row", justifyContent:"space-between", alignItems:"center", marginTop:6 },
  row:{ backgroundColor:"#fff", borderRadius:10, padding:12, borderWidth:StyleSheet.hairlineWidth, borderColor:"#E5E7EB", flexDirection:"row", justifyContent:"space-between", alignItems:"center" },
  btn:{ backgroundColor:"#EEF2F6", paddingVertical:10, borderRadius:10, alignItems:"center" },
  btnText:{ fontWeight:"700" },
  primary:{ backgroundColor:"#2563eb" },
  primaryText:{ color:"#fff", fontWeight:"800" },
});
