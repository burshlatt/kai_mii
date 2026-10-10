import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  buildDashboardData,
  filterAssignments,
  isAssignmentOverdue,
  summarizeAssignments,
} from './dashboard.ts';
import type {
  Assignment,
  AssignmentFilter,
  AssignmentPriority,
  AssignmentStatus,
  AssignmentSummary,
} from './dashboard.ts';

const NOW = '2026-10-10T12:00:00.000Z';
const PAST_EARLY = '2026-10-01T12:00:00.000Z';
const PAST_LATE = '2026-10-05T12:00:00.000Z';
const FUTURE = '2026-10-20T12:00:00.000Z';
const SAME_INSTANT_OFFSET = '2026-10-10T15:00:00.000+03:00';
const ONE_MS_BEFORE = '2026-10-10T11:59:59.999Z';

function task(
  id: string,
  title: string,
  dueAt: string,
  status: AssignmentStatus,
  course = 'Алгебра',
  priority: AssignmentPriority = 'medium',
): Assignment {
  return { id, title, course, dueAt, status, priority };
}

function dashboardFilter(
  status: AssignmentFilter['status'],
  course: string,
  onlyOverdue: boolean,
): AssignmentFilter {
  return { status, course, onlyOverdue };
}

function copyOf(assignments: readonly Assignment[]): Assignment[] {
  return assignments.map((item) => ({ ...item }));
}

function expectVisible(
  assignments: readonly Assignment[],
  filter: AssignmentFilter,
  now: string,
  expectedItems: readonly Assignment[],
  expectedSummary: AssignmentSummary,
): void {
  const summary = summarizeAssignments(assignments, now);
  const filtered = filterAssignments(assignments, filter, now);
  const dashboard = buildDashboardData(assignments, filter, now);

  assert.deepEqual(summary, expectedSummary);
  assert.deepEqual(filtered, expectedItems);
  assert.deepEqual(dashboard.summary, expectedSummary);
  assert.deepEqual(dashboard.items, expectedItems);
  assert.deepEqual(
    dashboard.items.map((item) => item.id),
    expectedItems.map((item) => item.id),
  );
  assert.deepEqual(
    dashboard.items.map((item) => item.title),
    expectedItems.map((item) => item.title),
  );
  assert.notStrictEqual(filtered, assignments);
  assert.notStrictEqual(dashboard.items, assignments);
}

test('пустой список даёт пустые items и нулевую сводку', () => {
  const assignments: Assignment[] = [];
  const filter = dashboardFilter('todo', 'алгебра', true);
  const summary: AssignmentSummary = {
    total: 0,
    todo: 0,
    inProgress: 0,
    done: 0,
    overdue: 0,
  };

  expectVisible(assignments, filter, NOW, [], summary);
});

test('все done с датой в прошлом не просрочены и пропадают только при onlyOverdue', () => {
  const early = task('early', 'черновик', PAST_EARLY, 'done', 'Алгебра', 'low');
  const yolka = task('yolka', 'ёлка', PAST_LATE, 'done', 'Алгебра', 'high');
  const el = task('el', 'ель', PAST_LATE, 'done', 'Алгебра', 'medium');
  const assignments = [el, early, yolka];
  const summary: AssignmentSummary = {
    total: 3,
    todo: 0,
    inProgress: 0,
    done: 3,
    overdue: 0,
  };

  for (const assignment of assignments) {
    assert.equal(isAssignmentOverdue(assignment, NOW), false);
  }

  // Локаль ru: «ёлка» раньше «ель», потому что после общей «е/ё» буква «к» раньше «ь».
  expectVisible(
    assignments,
    dashboardFilter('all', '', false),
    NOW,
    [early, yolka, el],
    summary,
  );

  const hidden = buildDashboardData(assignments, dashboardFilter('all', '', true), NOW);
  assert.deepEqual(hidden.items, []);
  assert.deepEqual(hidden.summary, summary);
  assert.equal(hidden.summary.done, assignments.length);
  assert.equal(hidden.summary.overdue, 0);
});

test('битая дата не просрочена и стоит после валидных дат', () => {
  const past = task('past', 'ранний', PAST_EARLY, 'todo');
  const future = task('future', 'будущий', FUTURE, 'in_progress');
  const brokenYolka = task('broken-yolka', 'ёлка', 'not-a-date', 'todo');
  const brokenEl = task('broken-el', 'ель', '', 'done');
  const assignments = [brokenEl, future, brokenYolka, past];
  const summary: AssignmentSummary = {
    total: 4,
    todo: 2,
    inProgress: 1,
    done: 1,
    overdue: 1,
  };

  assert.equal(isAssignmentOverdue(past, NOW), true);
  assert.equal(isAssignmentOverdue(future, NOW), false);
  assert.equal(isAssignmentOverdue(brokenYolka, NOW), false);
  assert.equal(isAssignmentOverdue(brokenEl, NOW), false);

  expectVisible(
    assignments,
    dashboardFilter('all', '', false),
    NOW,
    [past, future, brokenYolka, brokenEl],
    summary,
  );
});

test('предмет сравнивается без краёв и регистра, пробельный фильтр означает все предметы', () => {
  const algebra = task('algebra', 'Края', PAST_EARLY, 'todo', '  Алгебра ');
  const physics = task('physics', 'Другой', PAST_LATE, 'in_progress', 'Физика');
  const innerSpace = task('inner-space', 'Пробел', FUTURE, 'todo', 'алгебра 2');
  const innerTight = task('inner-tight', 'Слитно', '2026-10-21T12:00:00.000Z', 'done', 'алгебра2');
  const assignments = [physics, innerTight, algebra, innerSpace];
  const summary: AssignmentSummary = {
    total: 4,
    todo: 2,
    inProgress: 1,
    done: 1,
    overdue: 2,
  };
  const allCourses = [algebra, physics, innerSpace, innerTight];

  expectVisible(
    assignments,
    dashboardFilter('all', 'алгебра', false),
    NOW,
    [algebra],
    summary,
  );
  expectVisible(
    assignments,
    dashboardFilter('all', '  алгебра  ', false),
    NOW,
    [algebra],
    summary,
  );
  expectVisible(assignments, dashboardFilter('all', '   ', false), NOW, allCourses, summary);
  expectVisible(
    assignments,
    dashboardFilter('all', 'алгебра 2', false),
    NOW,
    [innerSpace],
    summary,
  );
  expectVisible(
    assignments,
    dashboardFilter('all', 'алгебра2', false),
    NOW,
    [innerTight],
    summary,
  );
});

test('onlyOverdue и статус done оставляют пустой список и сводку исходного списка', () => {
  const donePast = task('done-past', 'сдано', PAST_EARLY, 'done');
  const doneFuture = task('done-future', 'заранее', FUTURE, 'done');
  const todoLate = task('todo-late', 'долг', PAST_LATE, 'todo');
  const progressLate = task('progress-late', 'в работе', PAST_EARLY, 'in_progress');
  const todoFuture = task('todo-future', 'план', FUTURE, 'todo');
  const assignments = [donePast, todoLate, doneFuture, progressLate, todoFuture];
  const summary: AssignmentSummary = {
    total: 5,
    todo: 2,
    inProgress: 1,
    done: 2,
    overdue: 2,
  };

  assert.equal(isAssignmentOverdue(donePast, NOW), false);
  assert.equal(isAssignmentOverdue(todoLate, NOW), true);
  assert.equal(isAssignmentOverdue(progressLate, NOW), true);
  assert.equal(isAssignmentOverdue(todoFuture, NOW), false);

  const dashboard = buildDashboardData(
    assignments,
    dashboardFilter('done', '', true),
    NOW,
  );
  assert.deepEqual(dashboard.items, []);
  assert.deepEqual(filterAssignments(assignments, dashboardFilter('done', '', true), NOW), []);
  assert.deepEqual(dashboard.summary, summary);
  assert.deepEqual(summarizeAssignments(assignments, NOW), summary);
  assert.equal(dashboard.summary.done, 2);
  assert.equal(dashboard.summary.overdue, 2);
});

test('просроченный todo виден без onlyOverdue, равные даты идут по title локалью ru, вход не мутируется', () => {
  const sameDue = PAST_LATE;
  const el = task('el', 'ель', sameDue, 'todo', 'Математика', 'high');
  const doneItem = task('done-item', 'готово', sameDue, 'done', 'Математика', 'low');
  const yolkaFirst = task('yolka-first', 'ёлка', sameDue, 'todo', 'Математика', 'low');
  const yolkaSecond = task('yolka-second', 'ёлка', sameDue, 'todo', 'Математика', 'high');
  const upcoming = task('upcoming', 'завтра', FUTURE, 'todo', 'Математика', 'medium');
  const assignments = [el, doneItem, yolkaFirst, yolkaSecond, upcoming];
  const before = copyOf(assignments);
  const summary: AssignmentSummary = {
    total: 5,
    todo: 4,
    inProgress: 0,
    done: 1,
    overdue: 3,
  };

  assert.equal(isAssignmentOverdue(el, NOW), true);
  assert.equal(isAssignmentOverdue(yolkaFirst, NOW), true);
  assert.equal(isAssignmentOverdue(upcoming, NOW), false);

  expectVisible(
    assignments,
    dashboardFilter('todo', '', false),
    NOW,
    [yolkaFirst, yolkaSecond, el, upcoming],
    summary,
  );
  assert.deepEqual(assignments, before);
  assert.deepEqual(
    assignments.map((item) => item.id),
    ['el', 'done-item', 'yolka-first', 'yolka-second', 'upcoming'],
  );
});

test('равенство меток dueAt и now не является просрочкой', () => {
  const equalTodo = task('equal-todo', 'равно', NOW, 'todo');
  const equalOffset = task('equal-offset', 'пояс', SAME_INSTANT_OFFSET, 'in_progress');
  const before = task('before', 'раньше', ONE_MS_BEFORE, 'todo');
  const after = task('after', 'позже', FUTURE, 'todo');
  const doneBefore = task('done-before', 'сдано', PAST_EARLY, 'done');
  const assignments = [equalTodo, after, doneBefore, equalOffset, before];
  const summary: AssignmentSummary = {
    total: 5,
    todo: 3,
    inProgress: 1,
    done: 1,
    overdue: 1,
  };

  assert.equal(Date.parse(SAME_INSTANT_OFFSET), Date.parse(NOW));
  assert.equal(isAssignmentOverdue(equalTodo, NOW), false);
  assert.equal(isAssignmentOverdue(equalOffset, NOW), false);
  assert.equal(isAssignmentOverdue(before, NOW), true);
  assert.equal(isAssignmentOverdue(after, NOW), false);
  assert.equal(isAssignmentOverdue(doneBefore, NOW), false);

  expectVisible(
    assignments,
    dashboardFilter('all', '', false),
    NOW,
    [before, doneBefore, equalOffset, equalTodo, after],
    summary,
  );

  const onlyOverdue = buildDashboardData(assignments, dashboardFilter('all', '', true), NOW);
  assert.deepEqual(onlyOverdue.items, [before]);
  assert.deepEqual(onlyOverdue.summary, summary);
});

test('битый now не бросает исключение и не создаёт просрочку', () => {
  const brokenNow = 'вчера';
  const pastTodo = task('past-todo', 'долг', PAST_EARLY, 'todo');
  const pastProgress = task('past-progress', 'черновик', PAST_LATE, 'in_progress');
  const brokenDue = task('broken-due', 'битая', 'not-a-date', 'todo');
  const assignments = [brokenDue, pastProgress, pastTodo];
  const summary: AssignmentSummary = {
    total: 3,
    todo: 2,
    inProgress: 1,
    done: 0,
    overdue: 0,
  };

  assert.equal(isAssignmentOverdue(pastTodo, brokenNow), false);
  assert.equal(isAssignmentOverdue(pastProgress, brokenNow), false);
  assert.equal(isAssignmentOverdue(brokenDue, brokenNow), false);

  expectVisible(
    assignments,
    dashboardFilter('all', '', false),
    brokenNow,
    [pastTodo, pastProgress, brokenDue],
    summary,
  );

  const onlyOverdue = buildDashboardData(
    assignments,
    dashboardFilter('all', '', true),
    brokenNow,
  );
  assert.deepEqual(onlyOverdue.items, []);
  assert.deepEqual(onlyOverdue.summary, summary);
});
