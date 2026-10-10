import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AssignmentCard } from '../components/AssignmentCard';

const NOW = '2026-10-10T12:00:00.000Z';

describe('AssignmentCard', () => {
  it('shows the loading, error and empty states', () => {
    const { rerender } = render(
      <AssignmentCard title="Эссе" course="История" dueAt={NOW} status="todo" isLoading />,
    );
    expect(screen.getByTestId('assignment-card-loading')).toHaveTextContent('Загружаем задание');

    rerender(
      <AssignmentCard title="Эссе" course="История" dueAt={NOW} status="todo" error="Нет сети" />,
    );
    expect(screen.getByTestId('assignment-card-error')).toHaveTextContent('Нет сети');

    rerender(<AssignmentCard title="  " course="История" dueAt={NOW} status="todo" />);
    expect(screen.getByTestId('assignment-card-empty')).toHaveTextContent('Пока пусто');
  });

  it('renders a russian status and the course', () => {
    render(
      <AssignmentCard
        title="Эссе про транспорт"
        course="История"
        dueAt="2026-10-12T12:00:00.000Z"
        status="in_progress"
        now={NOW}
      />,
    );
    const card = screen.getByTestId('assignment-card');
    expect(card).toHaveClass('assignment-card');
    expect(card).toHaveTextContent('История');
    expect(card).toHaveTextContent('Эссе про транспорт');
    expect(card).toHaveTextContent('В работе');
  });
});
