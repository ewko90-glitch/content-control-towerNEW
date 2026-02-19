export function reverseDeterministic<T>(items: T[]): T[] {
  return [...items].reverse();
}

export function rotateDeterministic<T>(items: T[]): T[] {
  if (items.length <= 1) {
    return [...items];
  }
  return [...items.slice(1), items[0]];
}

export function sortByIdDeterministic<T>(items: T[], readId: (item: T) => string): T[] {
  return [...items].sort((left, right) => readId(left).localeCompare(readId(right)));
}
