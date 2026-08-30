/**
 * Natural Alphanumeric Sorting Utility
 * Accurately sorts alphanumeric module locations (e.g. A1, A2, A3, A4... A10, A11)
 * and Spanish strings with proper numeric sensitivity.
 */

export function naturalLocationSort<T extends { location?: string; name?: string; code?: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const locA = (a.location || '').trim();
    const locB = (b.location || '').trim();

    if (locA && !locB) return -1;
    if (!locA && locB) return 1;

    if (locA && locB) {
      const cmp = locA.localeCompare(locB, 'es', { numeric: true, sensitivity: 'base' });
      if (cmp !== 0) return cmp;
    }

    // Secondary sort by name
    const nameA = (a.name || '').trim();
    const nameB = (b.name || '').trim();
    const nameCmp = nameA.localeCompare(nameB, 'es', { numeric: true, sensitivity: 'base' });
    if (nameCmp !== 0) return nameCmp;

    // Tertiary sort by code
    return (a.code || '').localeCompare(b.code || '', 'es', { numeric: true, sensitivity: 'base' });
  });
}

export function naturalStringSort(a: string, b: string): number {
  return (a || '').trim().localeCompare((b || '').trim(), 'es', { numeric: true, sensitivity: 'base' });
}
