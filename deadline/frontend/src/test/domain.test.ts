import { describe, expect, it } from 'vitest';
import {
  filterAssignments,
  isOverdue,
  summarize,
  validateAssignment,
  formatDueLabel,
  type Assignment,
} from '../domain';

const NOW = '2026-10-10T12:00:00.000Z';

function item(
  partial: Partial<Assignment> & Pick<Assignment, 'id' | 'title' | 'dueAt' | 'status'>,
): Assignment {
  return {
    course: 'История',
    description: '',
    priority: 'medium',
    createdAt: NOW,
    updatedAt: NOW,
    ...partial,
  };
}

describe('assignment rules', () => {
  const items = [
    item({
      id: '1',
      title: 'Эссе',
      dueAt: '2026-10-09T12:00:00.000Z',
      status: 'todo',
      priority: 'high',
    }),
    item({
      id: '2',
      title: 'Конспект',
      dueAt: '2026-10-09T12:00:00.000Z',
      status: 'done',
      course: 'Математический анализ',
    }),
    item({
      id: '3',
      title: 'Лаба',
      dueAt: '2026-10-12T12:00:00.000Z',
      status: 'in_progress',
      course: 'Алгоритмы',
    }),
    item({ id: '4', title: 'Битая дата', dueAt: 'не дата', status: 'todo', course: 'Философия' }),
  ];

  it('does not treat a finished past assignment as overdue', () => {
    expect(isOverdue(items[0].dueAt, items[0].status, NOW)).toBe(true);
    expect(isOverdue(items[1].dueAt, items[1].status, NOW)).toBe(false);
    expect(isOverdue('не дата', 'todo', NOW)).toBe(false);
  });

  it('filters by course and overdue, and sorts broken dates last', () => {
    const overdue = filterAssignments(items, { status: 'all', course: '', onlyOverdue: true }, NOW);
    expect(overdue.map((row) => row.id)).toEqual(['1']);

    const history = filterAssignments(
      items,
      { status: 'all', course: '  история ', onlyOverdue: false },
      NOW,
    );
    expect(history.map((row) => row.id)).toEqual(['1']);

    const doneAndOverdue = filterAssignments(
      items,
      { status: 'done', course: '', onlyOverdue: true },
      NOW,
    );
    expect(doneAndOverdue).toEqual([]);

    const ordered = filterAssignments(
      items,
      { status: 'all', course: '', onlyOverdue: false },
      NOW,
    );
    expect(ordered.map((row) => row.id)).toEqual(['1', '2', '3', '4']);
  });

  it('summarizes the original list and rejects an empty title', () => {
    const summary = summarize(items, NOW);
    expect(summary).toEqual({ total: 4, todo: 2, inProgress: 1, done: 1, overdue: 1 });
    expect(
      validateAssignment({
        title: '  ',
        course: 'История',
        description: '',
        dueAt: '2026-10-12T15:00',
        status: 'todo',
        priority: 'low',
      }).title,
    ).toBe('Укажите название');
  });

  it('formats today and a broken date', () => {
    const now = new Date(2026, 9, 10, 15, 0).toISOString();
    const sameDay = new Date(2026, 9, 10, 8, 30).toISOString();
    expect(formatDueLabel(sameDay, now).startsWith('Сегодня')).toBe(true);
    expect(formatDueLabel('не дата', now)).toBe('Дата не указана');
  });
});
