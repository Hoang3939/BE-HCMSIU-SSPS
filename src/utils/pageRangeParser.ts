export function parsePageRange(pageRange: string, totalPages: number): number[] {
  const pages: number[] = [];
  const parts = pageRange.split(',').map((s) => s.trim());

  for (const part of parts) {
    if (part.includes('-')) {
      const rangeParts = part.split('-').map((s) => s.trim());
      const startStr = rangeParts[0] || '';
      const endStr = rangeParts[1] || '';
      const start = Number.parseInt(startStr, 10);
      const end = Number.parseInt(endStr, 10);

      if (!Number.isNaN(start) && !Number.isNaN(end) && start <= end) {
        for (let i = Math.max(1, start); i <= Math.min(end, totalPages); i++) {
          if (!pages.includes(i)) {
            pages.push(i);
          }
        }
      }
    } else {
      const pageNum = Number.parseInt(part, 10);
      if (!Number.isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages && !pages.includes(pageNum)) {
        pages.push(pageNum);
      }
    }
  }
  return pages.sort((a, b) => a - b);
}

