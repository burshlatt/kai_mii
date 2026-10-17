import { useState, type FormEvent } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { ApiError } from '../api';
import { track } from '../analytics';
import { useAuth } from '../auth';
import { buttonClass, fieldClass, ghostClass } from '../components/ui';

const OAUTH_ERRORS: Record<string, string> = {
  oauth_unavailable:
    'Этот способ входа ещё не настроен. Войдите почтой или добавьте ключи провайдера.',
  oauth_denied: 'Вход через провайдера отменён.',
  oauth_email_taken: 'Почта из провайдера уже занята парольным аккаунтом.',
  oauth_failed: 'Не удалось завершить вход через провайдера.',
};

export function LoginPage(): JSX.Element {
  const auth = useAuth();
  const [params] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(OAUTH_ERRORS[params.get('error') ?? ''] ?? '');
  const [pending, setPending] = useState(false);

  if (auth.ready && auth.user) {
    return <Navigate to="/" replace />;
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setPending(true);
    setError('');
    try {
      await auth.login(email, password);
      track('login');
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось войти.');
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <p className="text-xs uppercase tracking-[0.18em] text-muted">Учебные задания</p>
      <h1 className="mt-2 font-serif text-5xl italic text-ink">Дедлайн</h1>
      <p className="mt-3 text-muted">Список того, что нужно сдать, и того, что уже горит.</p>
      <form className="mt-8 space-y-4" onSubmit={onSubmit}>
        <label className="block text-sm">
          Почта
          <input
            className={fieldClass}
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>
        <label className="block text-sm">
          Пароль
          <input
            className={fieldClass}
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>
        {error ? (
          <p className="text-sm text-seal" role="alert">
            {error}
          </p>
        ) : null}
        <button type="submit" className={buttonClass} disabled={pending || !auth.ready}>
          Войти
        </button>
      </form>
      <div className="mt-6">
        <a className={`${ghostClass} block text-center`} href="/api/auth/oauth/google/start">
          Войти через Google
        </a>
      </div>
      <p className="mt-6 text-sm">
        Нет аккаунта?{' '}
        <Link className="font-semibold text-seal" to="/register">
          Регистрация
        </Link>
      </p>
    </main>
  );
}
