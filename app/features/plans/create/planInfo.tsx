// app/features/plans/create/PlanInfo.tsx
import { View, Text, TextInput, Pressable, StyleSheet, Alert, Platform, Modal } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { router } from "expo-router";
import { useState } from "react";
import { usePlanDraft } from "./store";

export default function PlanInfo() {
  const { title, endDate, workoutsPerWeek, setMeta, initWorkouts } = usePlanDraft();
  const [show, setShow] = useState(false);
  const [tempDate, setTempDate] = useState<Date>(endDate ? new Date(endDate) : new Date());

  function proceed() {
    if (!title.trim()) return Alert.alert("Please add a plan title");
    if (!endDate) return Alert.alert("Please choose an end date");
    if (workoutsPerWeek < 1) return Alert.alert("Workouts per week must be at least 1");
    initWorkouts(workoutsPerWeek);              
    router.push({ pathname: "/features/plans/create/workout", params: { index: 0 } });
  }

  return (
    <View style={s.page}>
      <Text style={s.h2}>Plan Info</Text>

      <Text style={s.label}>Title</Text>
      <TextInput style={s.input} value={title} onChangeText={(t)=>setMeta({ title: t })} placeholder="Push/Pull/Legs" />

      <Text style={s.label}>End date</Text>
      <Pressable style={[s.input, { justifyContent: "center" }]} onPress={()=>setShow(true)}>
        <Text>{endDate ? new Date(endDate).toDateString() : "Select end date"}</Text>
      </Pressable>

      <Text style={s.label}>Workouts per week</Text>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {[1,2,3,4,5,6].map(n=>(
          <Pressable key={n} onPress={()=>setMeta({ workoutsPerWeek: n })} style={[s.chip, workoutsPerWeek===n && s.chipActive]}>
            <Text style={{ fontWeight: "700", color: workoutsPerWeek===n?"#fff":"#111" }}>{n}</Text>
          </Pressable>
        ))}
      </View>

      <Pressable style={s.primary} onPress={proceed}><Text style={s.primaryText}>Next →</Text></Pressable>

      {/* end date modal */}
      <Modal visible={show} transparent animationType="slide" onRequestClose={()=>setShow(false)}>
        <View style={s.modalScrim}>
          <View style={s.modalCard}>
            <Text style={s.h3}>Select End Date</Text>
            <DateTimePicker
              value={tempDate}
              mode="date"
              display={Platform.OS === "ios" ? "spinner" : "default"}
              minimumDate={new Date()}
              onChange={(_, d)=> d && setTempDate(d)}
            />
            <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
              <Pressable style={s.btn} onPress={()=>setShow(false)}><Text style={s.btnText}>Cancel</Text></Pressable>
              <Pressable style={[s.btn, s.primary]} onPress={()=>{
                setMeta({ endDate: tempDate.toISOString().slice(0,10) });
                setShow(false);
              }}><Text style={s.primaryText}>Done</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  page:{ flex:1, padding:16, backgroundColor:"#F7F8FA"},
  h2:{ fontSize:18, fontWeight:"800", marginBottom:12 },
  h3:{ fontSize:16, fontWeight:"800" },
  label:{ fontWeight:"700", marginTop:12, marginBottom:6 },
  input:{ backgroundColor:"#fff", padding:12, borderRadius:10, borderWidth:StyleSheet.hairlineWidth, borderColor:"#E5E7EB" },
  chip:{ paddingHorizontal:12, paddingVertical:8, borderRadius:999, backgroundColor:"#EEF2F6"},
  chipActive:{ backgroundColor:"#2563eb" },
  btn:{ backgroundColor:"#EEF2F6", paddingVertical:10, borderRadius:10, alignItems:"center", flex:1 },
  btnText:{ fontWeight:"700" },
  primary:{ backgroundColor:"#2563eb", paddingVertical:12, borderRadius:10, alignItems:"center", marginTop:16 },
  primaryText:{ color:"#fff", fontWeight:"800" },
  modalScrim:{ flex:1, backgroundColor:"rgba(0,0,0,0.3)", justifyContent:"flex-end"},
  modalCard:{ backgroundColor:"#fff", padding:16, borderTopLeftRadius:16, borderTopRightRadius:16 },
});
