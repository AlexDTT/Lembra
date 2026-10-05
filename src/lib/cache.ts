import { z } from 'zod';

export function readCache<T>(
  key: string,
  schema: z.ZodType<T>,
): { data: T; updatedAt: number } | undefined {
  try {
    const raw: unknown = JSON.parse(
      localStorage.getItem(`lembra-data:${key}`) || 'null',
    );
    const parsed = z
      .object({ data: schema, updatedAt: z.number() })
      .safeParse(raw);
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}
export function writeCache<T>(key: string, data: T) {
  try {
    localStorage.setItem(
      `lembra-data:${key}`,
      JSON.stringify({ data, updatedAt: Date.now() }),
    );
  } catch {
    /* Browser storage can be full or disabled. Queries still work online. */
  }
}
export function removeCache(key: string) {
  try {
    localStorage.removeItem(`lembra-data:${key}`);
  } catch {
    /* Storage can be disabled. */
  }
}
