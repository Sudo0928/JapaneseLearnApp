import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchMe, loginWithToken, setToken } from '../services/api';
import QuickSettingsControls from '../components/QuickSettingsControls';
import { useSettings } from '../context/settings';
import styles from '../styles';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (options: {
            client_id: string;
            callback: (response: { credential?: string }) => void;
          }) => void;
          renderButton: (element: HTMLElement, options: Record<string, unknown>) => void;
          prompt: () => void;
        };
      };
    };
  }
}

const GOOGLE_CLIENT_ID = String(import.meta.env.VITE_GOOGLE_CLIENT_ID_WEB ?? '').trim();

export default function LoginPage() {
  const { syncFromMe, t } = useSettings();
  const navigate = useNavigate();
  const buttonRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) {
      setError('VITE_GOOGLE_CLIENT_ID_WEB is missing.');
      return;
    }

    let cancelled = false;
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (cancelled || !buttonRef.current || !window.google) return;

      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async (response) => {
          if (!response.credential) {
            setError('Google did not return an ID token.');
            return;
          }

          setLoading(true);
          setError('');
          try {
            const auth = await loginWithToken(response.credential);
            setToken(auth.appToken);
            const me = await fetchMe();
            syncFromMe(me);
            navigate('/today', { replace: true });
          } catch (eventError) {
            setError(eventError instanceof Error ? eventError.message : String(eventError));
          } finally {
            setLoading(false);
          }
        },
      });

      buttonRef.current.innerHTML = '';
      window.google.accounts.id.renderButton(buttonRef.current, {
        theme: 'outline',
        size: 'large',
        width: 280,
        text: 'signin_with',
      });
      window.google.accounts.id.prompt();
    };
    document.body.appendChild(script);

    return () => {
      cancelled = true;
      script.remove();
    };
  }, [navigate, syncFromMe]);

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: 'var(--app-bg)', position: 'relative' }}>
      <div style={{ position: 'absolute', top: 20, right: 20 }}>
        <QuickSettingsControls />
      </div>
      <div style={{ width: '100%', maxWidth: 440, background: 'var(--app-surface)', borderRadius: 18, padding: 28, border: '1px solid var(--app-border)', boxShadow: 'var(--app-shadow)' }}>
        <h1 style={{ margin: '0 0 8px', fontSize: 30, color: 'var(--app-text)' }}>{t('web.loginTitle')}</h1>
        <p style={styles.subtext}>{t('web.loginSubtitle')}</p>
        {error ? <div style={styles.errorBox}>{error}</div> : null}
        <div ref={buttonRef} />
        {loading ? <p style={{ color: 'var(--app-text-muted)', marginTop: 16 }}>{t('common.loading')}</p> : null}
      </div>
    </div>
  );
}
