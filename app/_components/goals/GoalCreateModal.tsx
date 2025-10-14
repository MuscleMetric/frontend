import { useState } from "react";
import { Modal, View, Text, TextInput, Pressable, StyleSheet, Platform, ScrollView } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { supabase } from "@/lib/supabase";

const TYPES = [
  { value:"workout_frequency",label:"Workout Frequency" },
  { value:"steps_daily",label:"Daily Steps" },
  { value:"exercise_weight",label:"Exercise Weight" },
  { value:"exercise_reps",label:"Exercise Reps" },
  { value:"body_weight",label:"Bodyweight" },
  { value:"custom_numeric",label:"Custom Numeric" },
];

export default function GoalCreateModal({
  visible,onClose,userId,onCreated,
}:{
  visible:boolean; onClose:()=>void; userId:string; onCreated?:()=>void;
}){
  const [title,setTitle]=useState("");
  const [type,setType]=useState<string>("workout_frequency");
  const [target,setTarget]=useState<string>("");
  const [unit,setUnit]=useState<string>("");
  const [exerciseName,setExerciseName]=useState<string>("");
  const [period,setPeriod]=useState<"day"|"week"|"month"|"total">("week");
  const [due,setDue]=useState<Date|null>(null);
  const [showDue,setShowDue]=useState(false);

  async function create(){
    const payload:any={
      user_id:userId,title:title||"Goal",type,
      target:Number(target)||0,unit:unit||suggestedUnit(type),
      period:needsPeriod(type)?period:null,
      exercise_name:needsExercise(type)?exerciseName:null,
    };
    if(due) payload.due_date = due.toISOString().slice(0,10);
    const {error}=await supabase.from("personal_goals").insert(payload);
    if(!error){ onClose(); onCreated?.(); reset(); } else { console.warn(error); }
  }
  function reset(){ setTitle(""); setType("workout_frequency"); setTarget(""); setUnit(""); setExerciseName(""); setPeriod("week"); setDue(null); setShowDue(false); }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.backdrop}>
        <View style={s.sheet}>
          <Text style={s.h1}>Add Goal</Text>

          <Text style={s.label}>Title</Text>
          <TextInput style={s.input} value={title} onChangeText={setTitle} placeholder="Bench Press 100kg" />

          <Text style={s.label}>Type</Text>
          <ScrollRow value={type} onChange={setType} items={TYPES} />

          {needsExercise(type)&&(<>
            <Text style={s.label}>Exercise Name</Text>
            <TextInput style={s.input} value={exerciseName} onChangeText={setExerciseName} placeholder="Bench Press" />
          </>)}

          {needsPeriod(type)&&(<>
            <Text style={s.label}>Period</Text>
            <ScrollRow value={period} onChange={setPeriod} items={[
              {value:"day",label:"Day"},{value:"week",label:"Week"},{value:"month",label:"Month"},
            ]}/>
          </>)}

          <Text style={s.label}>Target</Text>
          <TextInput style={s.input} keyboardType="decimal-pad" value={target} onChangeText={setTarget} placeholder="e.g. 4" />

          <Text style={s.label}>Unit</Text>
          <TextInput style={s.input} value={unit} onChangeText={setUnit} placeholder={suggestedUnit(type)} />

          <Pressable onPress={()=>setShowDue(true)} style={[s.input,{justifyContent:"center"}]}>
            <Text style={{color:due?"#111827":"#9ca3af"}}>{due?due.toDateString():"Due date (optional)"}</Text>
          </Pressable>
          {showDue&&(
            <DateTimePicker
              value={due ?? new Date()}
              mode="date"
              display={Platform.OS==="ios"?"spinner":"default"}
              onChange={(_,d)=>{setShowDue(false); if(d) setDue(d);}}
              minimumDate={new Date()}
            />
          )}

          <View style={{flexDirection:"row",gap:10,marginTop:12}}>
            <Pressable style={[s.btn,{backgroundColor:"#e5e7eb"}]} onPress={onClose}><Text>Cancel</Text></Pressable>
            <Pressable style={[s.btn,{backgroundColor:"#2563eb"}]} onPress={create}><Text style={{color:"#fff",fontWeight:"700"}}>Create</Text></Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function needsExercise(t:string){ return ["exercise_weight","exercise_reps","exercise_1rm"].includes(t); }
function needsPeriod(t:string){ return ["workout_frequency","steps_daily"].includes(t); }
function suggestedUnit(t:string){
  switch(t){ case"workout_frequency":return"workouts"; case"steps_daily":return"steps";
    case"exercise_weight":return"kg"; case"exercise_reps":return"reps"; case"exercise_1rm":return"kg";
    case"distance":return"km"; case"time":return"min"; case"body_weight":return"kg"; default:return""; }
}

function ScrollRow({value,onChange,items}:{value:any;onChange:(v:any)=>void;items:{value:any;label:string}[];}){
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:8}} style={{marginBottom:10}}>
      {items.map(i=>{
        const active=i.value===value;
        return(
          <Pressable key={String(i.value)} onPress={()=>onChange(i.value)} style={[row.chip, active && row.active]}>
            <Text style={[row.txt, active && {color:"#fff"}]}>{i.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
const row = StyleSheet.create({
  chip:{paddingHorizontal:12,paddingVertical:8,borderRadius:999,borderWidth:1,borderColor:"#e5e7eb",backgroundColor:"#fff"},
  txt:{fontWeight:"700",color:"#111827"},
  active:{backgroundColor:"#2563eb",borderColor:"#2563eb"},
});
const s = StyleSheet.create({
  backdrop:{flex:1,backgroundColor:"rgba(0,0,0,0.35)",justifyContent:"flex-end"},
  sheet:{backgroundColor:"#fff",borderTopLeftRadius:16,borderTopRightRadius:16,padding:16},
  h1:{fontSize:18,fontWeight:"800",marginBottom:8},
  label:{fontWeight:"700",marginTop:8,marginBottom:6},
  input:{borderWidth:1,borderColor:"#e5e7eb",borderRadius:10,padding:12,backgroundColor:"#fff"},
  btn:{flex:1,alignItems:"center",padding:12,borderRadius:10},
});
