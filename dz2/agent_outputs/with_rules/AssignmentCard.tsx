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
