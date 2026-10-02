export function parseFavoriteIds(value: string | null, allowed: readonly string[]): string[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return [...new Set(parsed.filter((id): id is string => typeof id === 'string' && allowed.includes(id)))];
  } catch { return []; }
}
