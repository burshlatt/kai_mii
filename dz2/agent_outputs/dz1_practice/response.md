План:
1. Разобрать строки через `Date` и считать неразобранную дату недействительной.
2. `isOverdue` вернёт истину только если обе даты разобраны, срок раньше `now` и статус не `done`.
3. `formatDueLabel` соберёт подпись через `Intl.DateTimeFormat` (`ru-RU`): полный день с годом либо «Сегодня» с днём и коротким месяцем.

```typescript
const DUE_LABELS = {
  missing: 'Дата не указана',
  today: 'Сегодня',
} as const;

const FULL_DUE_FORMAT = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

const DAY_MONTH_FORMAT = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'short',
});

function parseDueDate(value: string): Date | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
}

function isSameLocalDay(left: Date, right: Date): boolean {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function partValue(
  parts: readonly Intl.DateTimeFormatPart[],
  type: Intl.DateTimeFormatPartTypes,
): string {
  return parts.find((part) => part.type === type)?.value ?? '';
}

function formatFullDue(date: Date): string {
  const parts = FULL_DUE_FORMAT.formatToParts(date);
  return `${partValue(parts, 'day')} ${partValue(parts, 'month')} ${partValue(parts, 'year')}`;
}

function formatDayMonth(date: Date): string {
  const parts = DAY_MONTH_FORMAT.formatToParts(date);
  return `${partValue(parts, 'day')} ${partValue(parts, 'month')}`;
}

export function isOverdue(
  dueAt: string,
  status: 'todo' | 'in_progress' | 'done',
  now: string,
): boolean {
  const due = parseDueDate(dueAt);
  const current = parseDueDate(now);
  if (due === null || current === null) {
    return false;
  }
  return due.getTime() < current.getTime() && status !== 'done';
}

export function formatDueLabel(dueAt: string, now: string): string {
  const due = parseDueDate(dueAt);
  if (due === null) {
    return DUE_LABELS.missing;
  }

  const current = parseDueDate(now);
  if (current !== null && isSameLocalDay(due, current)) {
    return `${DUE_LABELS.today}, ${formatDayMonth(due)}`;
  }

  return formatFullDue(due);
}
```
