// app/index.tsx
import { Redirect } from "expo-router";
import { useAuth } from "../lib/authContext";

export default function Index() {
  const { session, loading } = useAuth();
  if (loading) return null;

  if (session) {
    return <Redirect href="/" />;
  }

  // not logged in → auth
  return <Redirect href="/" />;
}
