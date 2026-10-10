import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

export interface ShellProps {
  name: string;
  onLogout: () => void;
  children: ReactNode;
}

function Brand(): JSX.Element {
  return (
    <Link to="/" className="font-serif text-3xl italic text-paper">
      Дедлайн
    </Link>
  );
}

export function Shell(props: ShellProps): JSX.Element {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="flex items-center justify-between bg-ink px-4 py-3 md:hidden">
        <Brand />
        <button
          type="button"
          className="border border-paper px-3 py-2 text-sm text-paper"
          onClick={props.onLogout}
        >
          Выйти
        </button>
      </header>
      <div className="md:grid md:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="hidden min-h-screen flex-col justify-between bg-ink px-6 py-8 text-paper md:flex">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-line">Учебные задания</p>
            <div className="mt-4">
              <Brand />
            </div>
            <p className="mt-8 text-sm text-line">{props.name}</p>
          </div>
          <button
            type="button"
            className="border border-paper px-4 py-2 text-left text-sm"
            onClick={props.onLogout}
          >
            Выйти
          </button>
        </aside>
        <main className="px-4 py-6 md:px-10 md:py-8">{props.children}</main>
      </div>
    </div>
  );
}
