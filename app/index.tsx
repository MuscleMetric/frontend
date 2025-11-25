// app/index.tsx
import { Redirect } from "expo-router";
import { useAuth } from "../lib/useAuth";

export default function Index() {
  const { loading } = useAuth();
  if (loading) return null;
  return <Redirect href="/(auth)/login" />;
}
