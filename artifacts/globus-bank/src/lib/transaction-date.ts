const calendarDatePattern = /^\d{4}-\d{2}-\d{2}$/;

function isCalendarDate(value: string): boolean {
  if (!calendarDatePattern.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(year, month - 1, day);
  return parsed.getFullYear() === year &&
    parsed.getMonth() === month - 1 &&
    parsed.getDate() === day;
}

export function customerTransactionDate(
  transactionDate: string | null | undefined,
  createdAt: string | Date,
): string {
  if (transactionDate && isCalendarDate(transactionDate)) {
    const [year, month, day] = transactionDate.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }
  const parsed = new Date(createdAt);
  return Number.isNaN(parsed.getTime())
    ? '—'
    : parsed.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
}

export function transactionDateInputValue(
  transactionDate: string | null | undefined,
  createdAt: string | Date,
): string {
  if (transactionDate && isCalendarDate(transactionDate)) return transactionDate;
  const parsed = new Date(createdAt);
  return Number.isNaN(parsed.getTime())
    ? ''
    : `${parsed.getUTCFullYear()}-${String(parsed.getUTCMonth() + 1).padStart(2, '0')}-${String(parsed.getUTCDate()).padStart(2, '0')}`;
}

export function todayCalendarDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
