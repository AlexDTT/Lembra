export async function fetchAll<T>(
  page: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await page(offset, offset + 999);
    if (error) throw error;
    if (!data) throw new Error('Missing page');
    rows.push(...data);
    if (data.length < 1000) return rows;
  }
}
