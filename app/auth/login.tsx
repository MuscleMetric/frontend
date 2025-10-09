import { View, Text, Button } from 'react-native';
import { useRouter } from 'expo-router';

export default function LoginScreen() {
  const router = useRouter();

  return (
    <View>
      <Text>Login Screen</Text>
      <Button
        title="Go to Home"
        onPress={() => router.replace('/(tabs)')}
      />
    </View>
  );
}
