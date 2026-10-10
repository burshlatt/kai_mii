type Metrika = {
  (id: number, action: 'hit' | 'reachGoal', target: string): void;
  (
    id: number,
    action: 'init',
    options: { clickmap: boolean; trackLinks: boolean; accurateTrackBounce: boolean },
  ): void;
};

declare global {
  interface Window {
    ym?: Metrika;
  }
}

export function metrikaId(): number | null {
  const raw = import.meta.env.VITE_METRIKA_ID;
  if (!raw) {
    return null;
  }
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export function track(event: string): void {
  const id = metrikaId();
  if (!id || !window.ym) {
    return;
  }
  window.ym(id, 'reachGoal', event);
}

export function trackPage(path: string): void {
  const id = metrikaId();
  if (!id || !window.ym) {
    return;
  }
  window.ym(id, 'hit', path);
}

export function installMetrika(id: number): void {
  if (document.getElementById('metrika-tag')) {
    return;
  }
  const script = document.createElement('script');
  script.id = 'metrika-tag';
  script.text = `(function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};m[i].l=1*new Date();for(var j=0;j<document.scripts.length;j++){if(document.scripts[j].src===r){return;}}k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})(window, document, "script", "https://mc.yandex.ru/metrika/tag.js", "ym");`;
  document.head.appendChild(script);
  window.ym?.(id, 'init', {
    clickmap: true,
    trackLinks: true,
    accurateTrackBounce: true,
  });
}
