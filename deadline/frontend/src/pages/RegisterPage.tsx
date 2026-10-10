import { useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { ApiError } from '../api';
import { track } from '../analytics';
import { useAuth } from '../auth';
import { buttonClass, fieldClass } from '../components/ui';

export function RegisterPage(): JSX.Element {
  const auth = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  if (auth.ready && auth.user) {
    return <Navigate to="/" replace />;
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setPending(true);
    setError('');
    try {
      await auth.register(name, email, password);
      track('register');
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось создать аккаунт.');
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <h1 className="font-serif text-5xl italic text-ink">Регистрация</h1>
      <p className="mt-3 text-muted">Один человек — один список. Чужие задания не видны.</p>
      <form className="mt-8 space-y-4" onSubmit={onSubmit}>
        <label className="block text-sm">
          Имя
          <input
            className={fieldClass}
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
        </label>
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
            autoComplete="new-password"
            minLength={8}
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
          Создать аккаунт
        </button>
      </form>
      <p className="mt-6 text-sm">
        Уже есть аккаунт?{' '}
        <Link className="font-semibold text-seal" to="/login">
          Войти
        </Link>
      </p>
    </main>
  );
}
