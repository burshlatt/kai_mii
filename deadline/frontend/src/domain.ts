export const STATUSES = ['todo', 'in_progress', 'done'] as const;
export const PRIORITIES = ['low', 'medium', 'high'] as const;

export type AssignmentStatus = (typeof STATUSES)[number];
export type AssignmentPriority = (typeof PRIORITIES)[number];
export type StatusFilter = AssignmentStatus | 'all';

export interface Assignment {
  id: string;
  title: string;
  course: string;
  description: string;
  dueAt: string;
  status: AssignmentStatus;
  priority: AssignmentPriority;
  createdAt: string;
  updatedAt: string;
}

export interface AssignmentFilter {
  status: StatusFilter;
  course: string;
  onlyOverdue: boolean;
}

export interface AssignmentSummary {
  total: number;
  todo: number;
  inProgress: number;
  done: number;
  overdue: number;
}

export const STATUS_LABEL: Record<AssignmentStatus, string> = {
  todo: 'К выполнению',
  in_progress: 'В работе',
  done: 'Готово',
};

export const PRIORITY_LABEL: Record<AssignmentPriority, string> = {
  low: 'Низкий',
  medium: 'Средний',
  high: 'Высокий',
};

export interface AssignmentDraft {
  title: string;
  course: string;
  description: string;
  dueAt: string;
  status: AssignmentStatus;
  priority: AssignmentPriority;
}

export function isOverdue(dueAt: string, status: AssignmentStatus, now: string): boolean {
  if (status === 'done') {
    return false;
  }
  const due = Date.parse(dueAt);
  const current = Date.parse(now);
  if (Number.isNaN(due) || Number.isNaN(current)) {
    return false;
  }
  return due < current;
}

function dueValue(dueAt: string): number {
  const value = Date.parse(dueAt);
  return Number.isNaN(value) ? Number.POSITIVE_INFINITY : value;
}

export function filterAssignments(
  items: Assignment[],
  filter: AssignmentFilter,
  now: string,
): Assignment[] {
  const course = filter.course.trim().toLowerCase();
  const filtered = items.filter((item) => {
    if (filter.status !== 'all' && item.status !== filter.status) {
      return false;
    }
    if (course && item.course.trim().toLowerCase() !== course) {
      return false;
    }
    if (filter.onlyOverdue && !isOverdue(item.dueAt, item.status, now)) {
      return false;
    }
    return true;
  });
  return filtered.sort((left, right) => {
    const leftOverdue = isOverdue(left.dueAt, left.status, now) ? 0 : 1;
    const rightOverdue = isOverdue(right.dueAt, right.status, now) ? 0 : 1;
    if (leftOverdue !== rightOverdue) {
      return leftOverdue - rightOverdue;
    }
    const byDate = dueValue(left.dueAt) - dueValue(right.dueAt);
    if (byDate !== 0) {
      return byDate;
    }
    return left.title.localeCompare(right.title, 'ru');
  });
}

export function summarize(items: Assignment[], now: string): AssignmentSummary {
  return {
    total: items.length,
    todo: items.filter((item) => item.status === 'todo').length,
    inProgress: items.filter((item) => item.status === 'in_progress').length,
    done: items.filter((item) => item.status === 'done').length,
    overdue: items.filter((item) => isOverdue(item.dueAt, item.status, now)).length,
  };
}

export function validateAssignment(draft: AssignmentDraft): Record<string, string> {
  const fields: Record<string, string> = {};
  if (!draft.title.trim()) {
    fields.title = 'Укажите название';
  } else if (draft.title.trim().length > 200) {
    fields.title = 'Название длиннее 200 символов';
  }
  if (!draft.course.trim()) {
    fields.course = 'Укажите предмет';
  }
  if (!draft.dueAt || Number.isNaN(Date.parse(draft.dueAt))) {
    fields.dueAt = 'Укажите дедлайн';
  }
  return fields;
}

export function formatDueLabel(dueAt: string, now: string): string {
  const due = new Date(dueAt);
  const current = new Date(now);
  if (Number.isNaN(due.getTime()) || Number.isNaN(current.getTime())) {
    return 'Дата не указана';
  }
  const sameDay =
    due.getFullYear() === current.getFullYear() &&
    due.getMonth() === current.getMonth() &&
    due.getDate() === current.getDate();
  if (sameDay) {
    const dayMonth = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' }).format(
      due,
    );
    return `Сегодня, ${dayMonth}`;
  }
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(due);
}

export function toDateTimeLocalValue(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const pad = (value: number): string => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function nextStatus(status: AssignmentStatus): AssignmentStatus | null {
  if (status === 'todo') {
    return 'in_progress';
  }
  if (status === 'in_progress') {
    return 'done';
  }
  return null;
}
