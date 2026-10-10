import { buttonClass } from './ui';

export interface ErrorBannerProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorBanner(props: ErrorBannerProps): JSX.Element {
  return (
    <div
      className="border border-seal bg-card px-4 py-3 text-sm text-seal"
      data-testid="error-banner"
      role="alert"
    >
      <p>{props.message}</p>
      {props.onRetry ? (
        <button type="button" className={`${buttonClass} mt-3`} onClick={props.onRetry}>
          Повторить
        </button>
      ) : null}
    </div>
  );
}

export function LoadingBlock(): JSX.Element {
  return (
    <p className="py-8 text-muted" data-testid="loading-block">
      Загружаем задания
    </p>
  );
}
