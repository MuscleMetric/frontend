// app/index.tsx
import { Redirect } from "expo-router";
import { useAuth } from "../lib/useAuth";

export default function Index() {
  const { session, loading } = useAuth();
  if (loading) return null;
  return session ? <Redirect href="../(tabs)/index" /> : <Redirect href="/(auth)/login" />;
}
