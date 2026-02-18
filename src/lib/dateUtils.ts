import { isValid } from 'date-fns';

/**
 * Safely normalize and parse date strings with Safari compatibility.
 * Handles ISO strings with or without timezone information.
 * 
 * Safari is strict about ISO 8601 parsing and may interpret timezone-less
 * strings as UTC, causing 24-hour offset issues. This function ensures
 * consistent local date interpretation across all browsers.
 */

export function normalizeDateInput(value?: string | null): string {
  if (!value) return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  return trimmed.includes('T') ? trimmed.split('T')[0] : trimmed;
}

/**
 * Parse a date string to a Date object with Safari compatibility.
 * Forces UTC interpretation and converts back to local date to avoid
 * timezone offset issues in Safari.
 */
export function parsePlannerDate(value?: string | null): Date | null {
  const normalized = normalizeDateInput(value);
  if (!normalized) return null;

  // Split date components and validate
  const [yearStr, monthStr, dayStr] = normalized.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);

  // Validate date components
  if (!yearStr || !monthStr || !dayStr || isNaN(year) || isNaN(month) || isNaN(day)) {
    return null;
  }

  // Create date using local constructor to avoid timezone interpretation issues
  // Month is 0-indexed in Date constructor
  const parsed = new Date(year, month - 1, day);

  // Verify the date is valid and components match what we wanted
  // (this catches invalid dates like Feb 30)
  if (
    !isValid(parsed) ||
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }

  return parsed;
}

/**
 * Safari-compatible day comparison that manually checks year, month, and date.
 * The date-fns isSameDay can fail when Date objects have timezone mismatches.
 */
export function isSameDayCompat(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

/**
 * Create a memoized date parser to avoid re-parsing the same strings.
 * Returns a function that caches parsed dates.
 */
export function createMemoizedDateParser() {
  const cache = new Map<string, Date | null>();

  return (dateStr: string | null | undefined): Date | null => {
    if (!dateStr) return null;
    
    const key = String(dateStr);
    if (cache.has(key)) {
      return cache.get(key) || null;
    }

    const result = parsePlannerDate(dateStr);
    cache.set(key, result);
    return result;
  };
}
