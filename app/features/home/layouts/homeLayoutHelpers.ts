export function pickCard(cards: any[], type: string) {
  return cards.find((c) => c?.type === type) ?? null;
}

export function excludeTypes(cards: any[], types: string[]) {
  const set = new Set(types);
  return cards.filter((c) => c?.type && !set.has(c.type));
}
