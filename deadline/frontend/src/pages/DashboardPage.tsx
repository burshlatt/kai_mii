import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ApiError, api, networkMessage } from '../api';
import { track } from '../analytics';
import { AssignmentCard } from '../components/AssignmentCard';
import { FilterBar } from '../components/FilterBar';
import { ErrorBanner, LoadingBlock } from '../components/States';
import { SummaryStrip } from '../components/SummaryStrip';
import { buttonClass } from '../components/ui';
import {
  filterAssignments,
  isOverdue,
  nextStatus,
  summarize,
  type Assignment,
  type AssignmentFilter,
  type StatusFilter,
} from '../domain';

interface ListResponse {
  assignments: Assignment[];
}

function readFilter(params: URLSearchParams): AssignmentFilter {
  const status = params.get('status');
  const allowed: StatusFilter[] = ['all', 'todo', 'in_progress', 'done'];
  return {
    status: allowed.find((item) => item === status) ?? 'all',
    course: params.get('course') ?? '',
    onlyOverdue: params.get('overdue') === '1',
  };
}

export function DashboardPage(): JSX.Element {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const filter = readFilter(params);
  const [items, setItems] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [advancingId, setAdvancingId] = useState('');
  const now = useMemo(() => new Date().toISOString(), [items]);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError('');
    try {
      const payload = await api<ListResponse>('/api/assignments');
      setItems(payload.assignments);
    } catch (caught) {
      setError(networkMessage(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = filterAssignments(items, filter, now);
  const summary = summarize(items, now);
  const courses = Array.from(new Set(items.map((item) => item.course))).sort((a, b) =>
    a.localeCompare(b, 'ru'),
  );

  function onFilter(next: AssignmentFilter): void {
    const query: Record<string, string> = {};
    if (next.status !== 'all') {
      query.status = next.status;
    }
    if (next.course.trim()) {
      query.course = next.course;
    }
    if (next.onlyOverdue) {
      query.overdue = '1';
    }
    setParams(query);
  }

  async function advance(item: Assignment): Promise<void> {
    const status = nextStatus(item.status);
    if (!status) {
      return;
    }
    setAdvancingId(item.id);
    try {
      const payload = await api<{ assignment: Assignment }>(`/api/assignments/${item.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      setItems((current) => current.map((row) => (row.id === item.id ? payload.assignment : row)));
      track('assignment_updated');
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : networkMessage(caught));
    } finally {
      setAdvancingId('');
    }
  }

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted">Сегодня</p>
          <h1 className="font-serif text-4xl text-ink md:text-5xl">Что сдавать</h1>
        </div>
        <button type="button" className={buttonClass} onClick={() => navigate('/assignments/new')}>
          Новое задание
        </button>
      </div>
      <div className="mt-6">
        <SummaryStrip summary={summary} />
      </div>
      <FilterBar filter={filter} courses={courses} onChange={onFilter} />
      <div className="mt-4">
        {loading ? <LoadingBlock /> : null}
        {!loading && error ? <ErrorBanner message={error} onRetry={() => void load()} /> : null}
        {!loading && !error && items.length === 0 ? (
          <AssignmentCard title="" course="" dueAt="" status="todo" />
        ) : null}
        {!loading && items.length > 0 && visible.length === 0 ? (
          <p className="py-8 text-muted" data-testid="no-results">
            Ничего не нашлось. Очистите предмет или снимите фильтр просрочки.
          </p>
        ) : null}
        {!loading && items.length > 0
          ? visible.map((item) => (
              <AssignmentCard
                key={item.id}
                title={item.title}
                course={item.course}
                dueAt={item.dueAt}
                status={item.status}
                priority={item.priority}
                description={item.description}
                overdue={isOverdue(item.dueAt, item.status, now)}
                now={now}
                onOpen={() => navigate(`/assignments/${item.id}`)}
                onAdvance={() => void advance(item)}
                advancing={advancingId === item.id}
              />
            ))
          : null}
      </div>
    </section>
  );
}
