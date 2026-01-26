export function makeDraftId(prefix = "draft") {
  // stable enough for local drafts + optimistic UI
  return `${prefix}_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}
