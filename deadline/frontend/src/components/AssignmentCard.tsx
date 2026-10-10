import {
  PRIORITY_LABEL,
  STATUS_LABEL,
  formatDueLabel,
  nextStatus,
  type AssignmentPriority,
  type AssignmentStatus,
} from '../domain';
import { ghostClass } from './ui';

export interface AssignmentCardProps {
  title: string;
  course: string;
  dueAt: string;
  status: AssignmentStatus;
  priority?: AssignmentPriority;
  description?: string;
  overdue?: boolean;
  now?: string;
  isLoading?: boolean;
  error?: string | null;
  onOpen?: () => void;
  onAdvance?: () => void;
  advancing?: boolean;
}

export function AssignmentCard(props: AssignmentCardProps): JSX.Element {
  if (props.isLoading) {
    return (
      <article
        className="assignment-card border-b border-line py-4"
        data-testid="assignment-card-loading"
      >
        <p className="text-sm text-muted">Загружаем задание</p>
      </article>
    );
  }

  if (props.error) {
    return (
      <article
        className="assignment-card border-b border-line py-4"
        data-testid="assignment-card-error"
      >
        <p className="text-sm text-seal">{props.error}</p>
      </article>
    );
  }

  if (!props.title.trim()) {
    return (
      <article className="assignment-card py-8" data-testid="assignment-card-empty">
        <p className="font-serif text-2xl text-ink">Пока пусто</p>
        <p className="mt-2 max-w-md text-muted">
          Добавьте первое задание, иначе дедлайн найдёт вас сам.
        </p>
      </article>
    );
  }

  const now = props.now ?? new Date().toISOString();
  const upcoming = nextStatus(props.status);

  return (
    <article
      className="assignment-card grid gap-3 border-b border-line py-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
      data-testid="assignment-card"
    >
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-moss">
          {props.course}
        </p>
        <h2 className="mt-1 font-serif text-2xl leading-tight text-ink">{props.title}</h2>
        {props.description ? <p className="mt-1 text-sm text-muted">{props.description}</p> : null}
        <p className={`mt-2 text-sm ${props.overdue ? 'text-seal' : 'text-ink'}`}>
          <span data-testid="due-label">{formatDueLabel(props.dueAt, now)}</span>
          {props.overdue ? ' · просрочено' : ''}
          {props.priority ? ` · ${PRIORITY_LABEL[props.priority]}` : ''}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-semibold">{STATUS_LABEL[props.status]}</span>
        {props.onOpen ? (
          <button type="button" className={ghostClass} onClick={props.onOpen}>
            Открыть
          </button>
        ) : null}
        {props.onAdvance && upcoming ? (
          <button
            type="button"
            className={ghostClass}
            onClick={props.onAdvance}
            disabled={props.advancing}
          >
            {upcoming === 'done' ? 'Готово' : 'В работу'}
          </button>
        ) : null}
      </div>
    </article>
  );
}
