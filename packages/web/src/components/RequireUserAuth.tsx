import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { clearToken, fetchMe, hasToken } from '../services/api';
import { useSettings } from '../context/settings';

export default function RequireUserAuth() {
  const { syncFromMe, t } = useSettings();
  const location = useLocation();
  const [state, setState] = useState<'checking' | 'ready' | 'blocked'>('checking');

  useEffect(() => {
    if (!hasToken()) {
      setState('blocked');
      return;
    }

    fetchMe()
      .then((me) => {
        syncFromMe(me);
        setState('ready');
      })
      .catch(() => {
        clearToken();
        setState('blocked');
      });
  }, [location.pathname, syncFromMe]);

  if (state === 'checking') {
    return (
      <div style={{ minHeight: '50vh', display: 'grid', placeItems: 'center', color: 'var(--app-text-muted)' }}>
        {t('common.loading')}
      </div>
    );
  }

  if (state === 'blocked') {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
