import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ApiError, api, networkMessage } from '../api';
import { track } from '../analytics';
import { ErrorBanner, LoadingBlock } from '../components/States';
import { buttonClass, fieldClass, ghostClass } from '../components/ui';
import {
  PRIORITY_LABEL,
  STATUS_LABEL,
  PRIORITIES,
  STATUSES,
  toDateTimeLocalValue,
  validateAssignment,
  type Assignment,
  type AssignmentDraft,
  type AssignmentPriority,
  type AssignmentStatus,
} from '../domain';

const EMPTY: AssignmentDraft = {
  title: '',
  course: '',
  description: '',
  dueAt: '',
  status: 'todo',
  priority: 'medium',
};

export function AssignmentFormPage(): JSX.Element {
  const { id } = useParams();
  const navigate = useNavigate();
  const editing = Boolean(id);
  const [draft, setDraft] = useState<AssignmentDraft>(EMPTY);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(editing);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!id) {
      return;
    }
    let active = true;
    setLoading(true);
    api<{ assignment: Assignment }>(`/api/assignments/${id}`)
      .then((payload) => {
        if (!active) {
          return;
        }
        const item = payload.assignment;
        setDraft({
          title: item.title,
          course: item.course,
          description: item.description,
          dueAt: toDateTimeLocalValue(item.dueAt),
          status: item.status,
          priority: item.priority,
        });
      })
      .catch((caught: unknown) => {
        if (active) {
          setError(networkMessage(caught));
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [id]);

  function update<K extends keyof AssignmentDraft>(key: K, value: AssignmentDraft[K]): void {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const problems = validateAssignment(draft);
    setFields(problems);
    if (Object.keys(problems).length > 0) {
      return;
    }
    setPending(true);
    setError('');
    const body = {
      ...draft,
      title: draft.title.trim(),
      course: draft.course.trim(),
      dueAt: new Date(draft.dueAt).toISOString(),
    };
    try {
      if (id) {
        await api(`/api/assignments/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
        track('assignment_updated');
      } else {
        await api('/api/assignments', { method: 'POST', body: JSON.stringify(body) });
        track('assignment_created');
      }
      navigate('/');
    } catch (caught) {
      if (caught instanceof ApiError && caught.fields) {
        setFields(caught.fields);
      }
      setError(networkMessage(caught));
    } finally {
      setPending(false);
    }
  }

  async function onDelete(): Promise<void> {
    if (!id || !window.confirm('Удалить задание?')) {
      return;
    }
    setPending(true);
    try {
      await api(`/api/assignments/${id}`, { method: 'DELETE' });
      track('assignment_deleted');
      navigate('/');
    } catch (caught) {
      setError(networkMessage(caught));
      setPending(false);
    }
  }

  return (
    <section className="max-w-xl">
      <Link className="text-sm text-seal" to="/">
        Назад к списку
      </Link>
      <h1 className="mt-3 font-serif text-4xl text-ink">{editing ? 'Правка' : 'Новое задание'}</h1>
      {loading ? <LoadingBlock /> : null}
      {!loading && error && !draft.title && editing ? <ErrorBanner message={error} /> : null}
      {!loading && (!editing || draft.title || !error) ? (
        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <label className="block text-sm">
            Название
            <input
              className={fieldClass}
              value={draft.title}
              onChange={(event) => update('title', event.target.value)}
            />
            {fields.title ? <span className="mt-1 block text-seal">{fields.title}</span> : null}
          </label>
          <label className="block text-sm">
            Предмет
            <input
              className={fieldClass}
              value={draft.course}
              onChange={(event) => update('course', event.target.value)}
            />
            {fields.course ? <span className="mt-1 block text-seal">{fields.course}</span> : null}
          </label>
          <label className="block text-sm">
            Дедлайн
            <input
              className={fieldClass}
              type="datetime-local"
              value={draft.dueAt}
              onChange={(event) => update('dueAt', event.target.value)}
            />
            {fields.dueAt ? <span className="mt-1 block text-seal">{fields.dueAt}</span> : null}
          </label>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block text-sm">
              Статус
              <select
                className={fieldClass}
                value={draft.status}
                onChange={(event) => update('status', event.target.value as AssignmentStatus)}
              >
                {STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {STATUS_LABEL[status]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              Приоритет
              <select
                className={fieldClass}
                value={draft.priority}
                onChange={(event) => update('priority', event.target.value as AssignmentPriority)}
              >
                {PRIORITIES.map((priority) => (
                  <option key={priority} value={priority}>
                    {PRIORITY_LABEL[priority]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="block text-sm">
            Комментарий
            <textarea
              className={`${fieldClass} min-h-28`}
              value={draft.description}
              onChange={(event) => update('description', event.target.value)}
            />
          </label>
          {error && draft.title ? (
            <p className="text-sm text-seal" role="alert">
              {error}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-3">
            <button type="submit" className={buttonClass} disabled={pending}>
              Сохранить
            </button>
            {editing ? (
              <button
                type="button"
                className={ghostClass}
                onClick={() => void onDelete()}
                disabled={pending}
              >
                Удалить
              </button>
            ) : null}
          </div>
        </form>
      ) : null}
    </section>
  );
}
