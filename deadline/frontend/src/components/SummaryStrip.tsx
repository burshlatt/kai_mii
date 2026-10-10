import type { AssignmentSummary } from '../domain';

export interface SummaryStripProps {
  summary: AssignmentSummary;
}

const ITEMS: Array<{ key: keyof AssignmentSummary; label: string }> = [
  { key: 'total', label: 'Всего' },
  { key: 'todo', label: 'К выполнению' },
  { key: 'inProgress', label: 'В работе' },
  { key: 'overdue', label: 'Просрочено' },
];

export function SummaryStrip(props: SummaryStripProps): JSX.Element {
  return (
    <section
      className="grid grid-cols-2 border border-line bg-card md:grid-cols-4"
      data-testid="summary-strip"
    >
      {ITEMS.map((item) => (
        <div
          key={item.key}
          className="border-line px-4 py-3 [&:nth-child(odd)]:border-r md:border-r md:last:border-r-0"
        >
          <p className="text-xs uppercase tracking-[0.14em] text-muted">{item.label}</p>
          <p
            className={`mt-1 font-serif text-4xl ${item.key === 'overdue' ? 'text-seal' : 'text-ink'}`}
          >
            {props.summary[item.key]}
          </p>
        </div>
      ))}
    </section>
  );
}
