export type AssignmentStatus = 'todo' | 'in_progress' | 'done';

export type AssignmentPriority = 'low' | 'medium' | 'high';

export type Assignment = {
  id: string;
  title: string;
  course: string;
  dueAt: string;
  status: AssignmentStatus;
  priority: AssignmentPriority;
};

export type AssignmentFilter = {
  status: AssignmentStatus | 'all';
  course: string;
  onlyOverdue: boolean;
};

export type AssignmentSummary = {
  total: number;
  todo: number;
  inProgress: number;
  done: number;
  overdue: number;
};

export type DashboardData = {
  items: Assignment[];
  summary: AssignmentSummary;
};

function parsedTimestamp(value: string): number | null {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    return null;
  }
  return timestamp;
}

export function isAssignmentOverdue(assignment: Assignment, now: string): boolean {
  if (assignment.status !== 'todo' && assignment.status !== 'in_progress') {
    return false;
  }
  const due = parsedTimestamp(assignment.dueAt);
  const current = parsedTimestamp(now);
  if (due === null || current === null) {
    return false;
  }
  return due < current;
}

export function summarizeAssignments(
  assignments: readonly Assignment[],
  now: string,
): AssignmentSummary {
  let todo = 0;
  let inProgress = 0;
  let done = 0;
  let overdue = 0;

  for (const assignment of assignments) {
    if (assignment.status === 'todo') {
      todo += 1;
    } else if (assignment.status === 'in_progress') {
      inProgress += 1;
    } else {
      done += 1;
    }
    if (isAssignmentOverdue(assignment, now)) {
      overdue += 1;
    }
  }

  return {
    total: assignments.length,
    todo,
    inProgress,
    done,
    overdue,
  };
}

function matchesCourse(course: string, filterCourse: string): boolean {
  const expected = filterCourse.trim().toLocaleLowerCase('ru');
  if (expected.length === 0) {
    return true;
  }
  return course.trim().toLocaleLowerCase('ru') === expected;
}

function matchesFilter(assignment: Assignment, filter: AssignmentFilter, now: string): boolean {
  if (filter.status !== 'all' && assignment.status !== filter.status) {
    return false;
  }
  if (!matchesCourse(assignment.course, filter.course)) {
    return false;
  }
  if (filter.onlyOverdue && !isAssignmentOverdue(assignment, now)) {
    return false;
  }
  return true;
}

function compareAssignments(left: Assignment, right: Assignment, now: string): number {
  const leftOverdue = isAssignmentOverdue(left, now);
  const rightOverdue = isAssignmentOverdue(right, now);
  if (leftOverdue !== rightOverdue) {
    return leftOverdue ? -1 : 1;
  }

  const leftDue = parsedTimestamp(left.dueAt);
  const rightDue = parsedTimestamp(right.dueAt);
  if (leftDue === null && rightDue !== null) {
    return 1;
  }
  if (leftDue !== null && rightDue === null) {
    return -1;
  }
  if (leftDue !== null && rightDue !== null && leftDue !== rightDue) {
    return leftDue < rightDue ? -1 : 1;
  }

  return left.title.localeCompare(right.title, 'ru');
}

export function filterAssignments(
  assignments: readonly Assignment[],
  filter: AssignmentFilter,
  now: string,
): Assignment[] {
  return assignments
    .map((assignment, index) => ({ assignment, index }))
    .filter((entry) => matchesFilter(entry.assignment, filter, now))
    .sort((left, right) => {
      const byKey = compareAssignments(left.assignment, right.assignment, now);
      if (byKey !== 0) {
        return byKey;
      }
      return left.index - right.index;
    })
    .map((entry) => entry.assignment);
}

export function buildDashboardData(
  assignments: readonly Assignment[],
  filter: AssignmentFilter,
  now: string,
): DashboardData {
  const summary = summarizeAssignments(assignments, now);
  const items = filterAssignments(assignments, filter, now);
  return { items, summary };
}
