## План

1. Задать `AssignmentCardProps` и константные карты подписей и цветовых классов статусов.
2. Форматировать дедлайн через `Intl.DateTimeFormat` с локалью `ru-RU`.
3. Вернуть состояние загрузки, ошибки, пустого названия или заполненную карточку.
4. На корне каждого состояния оставить класс `assignment-card` и свой `data-testid`.

## Код

```tsx
import type { ReactElement } from "react";

export type AssignmentStatus = "todo" | "in_progress" | "done";

export type AssignmentCardProps = {
  title: string;
  course: string;
  dueAt: string;
  status: AssignmentStatus;
  isLoading?: boolean;
  error?: string | null;
};

const ASSIGNMENT_STATUS_LABELS: Record<AssignmentStatus, string> = {
  todo: "К выполнению",
  in_progress: "В работе",
  done: "Готово",
};

const ASSIGNMENT_STATUS_CLASS_NAMES: Record<AssignmentStatus, string> = {
  todo: "bg-amber-50 text-amber-800",
  in_progress: "bg-sky-50 text-sky-800",
  done: "bg-emerald-50 text-emerald-800",
};

const STATUS_BADGE_CLASS_NAME =
  "inline-flex rounded-full px-2.5 py-1 text-xs font-medium";

const CARD_CLASS_NAME =
  "assignment-card rounded-2xl border border-slate-200 bg-white p-5 shadow-sm";

const DUE_DATE_FORMATTER = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function formatDueAt(dueAt: string): { label: string; dateTime: string | null } {
  const dueDate = new Date(dueAt);
  if (Number.isNaN(dueDate.getTime())) {
    return { label: "Дата не указана", dateTime: null };
  }
  return {
    label: DUE_DATE_FORMATTER.format(dueDate),
    dateTime: dueAt,
  };
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
        className={CARD_CLASS_NAME}
        data-testid="assignment-card-loading"
        aria-busy="true"
        aria-live="polite"
      >
        <p className="text-sm text-slate-600">Загрузка задания…</p>
      </article>
    );
  }

  if (error) {
    return (
      <article
        className={CARD_CLASS_NAME}
        data-testid="assignment-card-error"
        role="alert"
      >
        <h2 className="text-base font-semibold text-slate-900">
          Не удалось показать задание
        </h2>
        <p className="mt-2 text-sm text-rose-700">{error}</p>
      </article>
    );
  }

  if (title.trim() === "") {
    return (
      <article className={CARD_CLASS_NAME} data-testid="assignment-card-empty">
        <p className="text-sm text-slate-600">Нет данных о задании</p>
      </article>
    );
  }

  const dueAtView = formatDueAt(dueAt);
  const statusLabel = ASSIGNMENT_STATUS_LABELS[status];
  const statusClassName = ASSIGNMENT_STATUS_CLASS_NAMES[status];

  return (
    <article className={CARD_CLASS_NAME} data-testid="assignment-card">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <dl className="mt-4 space-y-3 text-sm">
        <div>
          <dt className="text-slate-500">Предмет</dt>
          <dd className="mt-1 text-slate-900">{course}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Дедлайн</dt>
          <dd className="mt-1 text-slate-900">
            {dueAtView.dateTime === null ? (
              dueAtView.label
            ) : (
              <time dateTime={dueAtView.dateTime}>{dueAtView.label}</time>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Статус</dt>
          <dd className="mt-1">
            <span className={`${STATUS_BADGE_CLASS_NAME} ${statusClassName}`}>
              {statusLabel}
            </span>
          </dd>
        </div>
      </dl>
    </article>
  );
}
```

## Применённые пункты rules.md

1. Роль: типобезопасный TypeScript и спокойные русские тексты интерфейса.
2. Контекст: React и Tailwind без UI-китов; статусы `todo`, `in_progress`, `done`.
3. Стиль 1: `AssignmentCard` и типы в PascalCase, функции и переменные в camelCase, константы модуля в SCREAMING_SNAKE_CASE.
4. Стиль 2: пропсы названы `AssignmentCardProps`.
5. Стиль 3: компонент объявлен как `export function` с явным возвращаемым типом `ReactElement`.
6. Стиль 4: подписи и цветовые классы статусов лежат в константных картах.
7. Стиль 5: комментариев нет, намерение читается из имён.
8. Стиль 6: дедлайн форматируется через `Intl.DateTimeFormat` с локалью `ru-RU`.
9. Стиль 7: тексты интерфейса на русском, идентификаторы на английском.
10. Стиль 8: импорт React по умолчанию не используется, только `import type`.
11. Ограничение 9: нет `any`, `as any`, `@ts-ignore` и `@ts-expect-error`.
12. Ограничение 10: нет default-экспорта, классового компонента и inline-стилей.
13. Ограничение 11: в исходнике нет секретов, паролей и токенов.
14. Ограничение 12: SQL нет, пользовательский ввод в запросы не подставляется.
15. Ограничение 13: нет `moment`, `var`, классовых компонентов и `componentWillMount`.
16. Формат 14: сначала план из четырёх пунктов, затем целый файл без заглушек.
17. Формат 15: один компонент в файле `AssignmentCard.tsx`.
18. Формат 16: есть состояния загрузки, ошибки и пустых данных.
19. Формат 17: корневой класс `assignment-card`; подписи «К выполнению», «В работе», «Готово».
20. Формат 18: у корня `data-testid` равен `assignment-card`, `assignment-card-loading`, `assignment-card-error` или `assignment-card-empty`.
