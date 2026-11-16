export function pickDefined<T extends object, K extends keyof T>(
  source: T,
  fields: readonly K[],
): Partial<Pick<T, K>> {
  const result: Partial<Pick<T, K>> = {};
  for (const key of fields) {
    if (source[key] !== undefined) result[key] = source[key];
  }
  return result;
}
