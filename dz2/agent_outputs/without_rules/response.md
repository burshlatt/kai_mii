# Как понял задачу

Нужен один React-компонент `AssignmentCard` на TypeScript. Он показывает учебное задание: название, предмет, дедлайн и статус.

Пропсы:

- `title: string` — название задания
- `course: string` — предмет
- `dueAt: string` — дедлайн в ISO 8601
- `status: "todo" | "in_progress" | "done"` — статус
- `isLoading?: boolean` — признак загрузки
- `error?: string | null` — текст ошибки

Порядок состояний:

1. Если `isLoading` истинно — состояние загрузки.
2. Если передан непустой `error` — состояние ошибки.
3. Если `title` пустой (после обрезки пробелов) — пустое состояние.
4. Иначе карточка с названием, предметом, отформатированным дедлайном и подписью статуса.

Стиль существующих файлов не смотрел. Зависимости не ставил, тесты не запускал.

# Полный код

```tsx
import { type ReactElement } from "react";

export type AssignmentStatus = "todo" | "in_progress" | "done";

export interface AssignmentCardProps {
  title: string;
  course: string;
  dueAt: string;
  status: AssignmentStatus;
  isLoading?: boolean;
  error?: string | null;
}

const STATUS_LABELS: Record<AssignmentStatus, string> = {
  todo: "К выполнению",
  in_progress: "В работе",
  done: "Выполнено",
};

function formatDueAt(dueAt: string): string {
  const date = new Date(dueAt);
  if (Number.isNaN(date.getTime())) {
    return dueAt;
  }

  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function AssignmentCard({
  title,
  course,
  dueAt,
  status,
  isLoading = false,
  error = null,
}: AssignmentCardProps): ReactElement {
  if (isLoading) {
    return (
      <article
        className="assignment-card assignment-card--loading"
        aria-busy="true"
        aria-live="polite"
      >
        <p className="assignment-card__message">Загрузка задания…</p>
      </article>
    );
  }

  if (error) {
    return (
      <article className="assignment-card assignment-card--error" role="alert">
        <p className="assignment-card__message">Не удалось показать задание</p>
        <p className="assignment-card__error">{error}</p>
      </article>
    );
  }

  if (title.trim() === "") {
    return (
      <article className="assignment-card assignment-card--empty">
        <p className="assignment-card__message">Задание не указано</p>
      </article>
    );
  }

  return (
    <article className="assignment-card">
      <header className="assignment-card__header">
        <h2 className="assignment-card__title">{title}</h2>
        <span
          className={`assignment-card__status assignment-card__status--${status}`}
        >
          {STATUS_LABELS[status]}
        </span>
      </header>
      <p className="assignment-card__course">
        <span className="assignment-card__label">Предмет</span>
        {course}
      </p>
      <p className="assignment-card__due">
        <span className="assignment-card__label">Дедлайн</span>
        <time dateTime={dueAt}>{formatDueAt(dueAt)}</time>
      </p>
    </article>
  );
}

export default AssignmentCard;
```
