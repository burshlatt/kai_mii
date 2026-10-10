import { STATUS_LABEL, type AssignmentFilter, type StatusFilter } from '../domain';
import { fieldClass } from './ui';

export interface FilterBarProps {
  filter: AssignmentFilter;
  courses: string[];
  onChange: (filter: AssignmentFilter) => void;
}

export function FilterBar(props: FilterBarProps): JSX.Element {
  return (
    <form
      className="mt-6 grid gap-4 md:grid-cols-[180px_minmax(0,1fr)_auto] md:items-end"
      data-testid="filter-bar"
    >
      <label className="block text-sm">
        <span className="text-muted">Статус</span>
        <select
          className={fieldClass}
          value={props.filter.status}
          onChange={(event) =>
            props.onChange({ ...props.filter, status: event.target.value as StatusFilter })
          }
        >
          <option value="all">Все</option>
          <option value="todo">{STATUS_LABEL.todo}</option>
          <option value="in_progress">{STATUS_LABEL.in_progress}</option>
          <option value="done">{STATUS_LABEL.done}</option>
        </select>
      </label>
      <label className="block text-sm">
        <span className="text-muted">Предмет</span>
        <input
          className={fieldClass}
          list="course-options"
          value={props.filter.course}
          placeholder="Все предметы"
          onChange={(event) => props.onChange({ ...props.filter, course: event.target.value })}
        />
        <datalist id="course-options">
          {props.courses.map((course) => (
            <option key={course} value={course} />
          ))}
        </datalist>
      </label>
      <label className="flex items-center gap-2 pb-2 text-sm">
        <input
          type="checkbox"
          checked={props.filter.onlyOverdue}
          onChange={(event) =>
            props.onChange({ ...props.filter, onlyOverdue: event.target.checked })
          }
        />
        Только просроченные
      </label>
    </form>
  );
}
