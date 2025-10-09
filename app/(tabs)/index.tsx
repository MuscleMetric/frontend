import { View, Text, StyleSheet } from 'react-native';

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Welcome to MuscleMetrics 🏋️</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,                 
    justifyContent: 'center', 
    alignItems: 'center',     
    backgroundColor: '#000', // Optional: makes white text visible on black background
  },
  text: {
    color: 'white',           // White text color
    fontSize: 20,             // Optional: makes text bigger
    fontWeight: 'bold',       // Optional: makes text bold
  },
});