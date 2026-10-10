import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { installMetrika, metrikaId, trackPage } from '../analytics';

export function Metrika(): null {
  const location = useLocation();
  const id = metrikaId();

  useEffect(() => {
    if (!id) {
      return;
    }
    installMetrika(id);
  }, [id]);

  useEffect(() => {
    trackPage(location.pathname);
  }, [location.pathname]);

  return null;
}
