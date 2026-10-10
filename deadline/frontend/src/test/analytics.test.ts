import { afterEach, describe, expect, it, vi } from 'vitest';
import { installMetrika, metrikaId, track, trackPage } from '../analytics';

describe('analytics', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    delete window.ym;
    document.getElementById('metrika-tag')?.remove();
  });

  it('does nothing when the counter is not configured', () => {
    const ym = vi.fn();
    window.ym = ym;
    track('login');
    trackPage('/');
    expect(ym).not.toHaveBeenCalled();
  });

  it('ignores a counter id that is not a positive integer', () => {
    vi.stubEnv('VITE_METRIKA_ID', '0');
    expect(metrikaId()).toBeNull();
    vi.stubEnv('VITE_METRIKA_ID', 'abc');
    expect(metrikaId()).toBeNull();
  });

  it('loads the Yandex tag and sends a hit and a goal', () => {
    vi.stubEnv('VITE_METRIKA_ID', '123456');
    const ym = vi.fn();
    window.ym = ym;
    installMetrika(123456);
    const script = document.getElementById('metrika-tag');
    expect(script?.textContent).toContain('https://mc.yandex.ru/metrika/tag.js');
    expect(ym).toHaveBeenCalledWith(
      123456,
      'init',
      expect.objectContaining({ clickmap: true, trackLinks: true, accurateTrackBounce: true }),
    );
    trackPage('/assignments/new');
    expect(ym).toHaveBeenCalledWith(123456, 'hit', '/assignments/new');
    track('assignment_created');
    expect(ym).toHaveBeenCalledWith(123456, 'reachGoal', 'assignment_created');
    installMetrika(123456);
    expect(document.querySelectorAll('#metrika-tag')).toHaveLength(1);
  });
});
