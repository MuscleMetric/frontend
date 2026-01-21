let RUNTIME_ID: string | null = null;

export function getRuntimeId() {
  if (RUNTIME_ID) return RUNTIME_ID;
  RUNTIME_ID = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  return RUNTIME_ID;
}
