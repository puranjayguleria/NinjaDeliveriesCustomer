export type ServiceServiceDocLike = {
  id: string;
  name?: string | null;
  categoryMasterId?: string | null;
  masterCategoryId?: string | null;
};

const normalize = (value: unknown) => String(value ?? '').toLowerCase().trim();

/**
 * De-dupe service_services docs for UI so the same service isn't shown multiple times
 * when multiple companies provide it.
 *
 * Rule: if (category master) and (name) are the same, treat it as the same service.
 */
export function dedupeServicesByCategoryAndName<T extends ServiceServiceDocLike>(items: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];

  for (const item of items) {
    const name = normalize(item?.name);
    if (!name) continue;

    const category = normalize(item?.categoryMasterId || item?.masterCategoryId);
    const key = `${category}::${name}`;

    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }

  return out;
}
