# Проверка правил на одной и той же задаче

Задача для обоих прогонов была одной и той же: компонент `AssignmentCard` с названием, предметом, дедлайном, статусом и тремя состояниями — загрузка, ошибка, пустое название.

Промпт без правил явно запрещал читать репозиторий и `.cursorrules`. Промпт с правилами требовал сначала прочитать `rules.md` и соблюдать каждый пункт. Сырые ответы субагентов сохранены рядом:

- без правил: `agent_outputs/without_rules/response.md` и `AssignmentCard.tsx` — субагент [Карточка без правил](cc78448f-b3fe-4462-8dc3-83a4eb4bb2b2);
- с правилами: `agent_outputs/with_rules/response.md` и `AssignmentCard.tsx` — субагент [Карточка с правилами](96d637a9-3c10-473f-a0f2-184d9aba46ab).

Ниже вставлен сырой код обоих компонентов.

## Что изменилось

Без правил компонент уже был аккуратным: русские подписи, разбор даты через `Intl`, три состояния, нет `any`. Файл правил всё равно сдвинул результат в сторону контракта проекта.

| Место | Без правил | С правилами |
| --- | --- | --- |
| Экспорт | Есть `export default AssignmentCard` | Только `export function`, default-экспорта нет |
| Подпись `done` | «Выполнено» | «Готово», как требует пункт 17 |
| `data-testid` | Нет | `assignment-card`, `assignment-card-loading`, `assignment-card-error`, `assignment-card-empty` |
| Битая дата | На карточку выводится исходная строка | Текст «Дата не указана» |
| Цвета статуса | Зашиты в строки классов по месту | Вынесены в константную карту |
| План до кода | Нет, сразу объяснение и код | Четыре пункта плана, затем файл |

Правила не выдумали новый компонент. Они убрали расхождения, которые иначе всплывают на ревью: чужое имя статуса, лишний default-экспорт и отсутствие крючков для теста. Оба прогона заняли одну итерацию. Повторный запрос не понадобился: ответ с правилами закрыл пункты 9, 10, 16, 17 и 18 файла `rules.md`, и субагент сам перечислил это в конце `with_rules/response.md`.

Визуальная палитра «Чернильница» в прогоне с правилами не появилась. В `rules.md` нет конкретных цветов, поэтому агент взял нейтральные классы Tailwind. Для экрана приложения палитра задана уже в вёрстке, а не в этом контрольном прогоне.

## Сырой ответ без правил

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

## Сырой ответ с правилами

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
