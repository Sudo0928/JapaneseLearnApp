import { NavLink, Outlet } from 'react-router-dom';
import { useSettings } from '../context/settings';
import QuickSettingsControls from './QuickSettingsControls';

const NAV_ITEMS = [
  { to: '/today', labelKey: 'web.nav.today' as const },
  { to: '/report', labelKey: 'web.nav.report' as const },
  { to: '/experiments', labelKey: 'web.nav.experiments' as const },
  { to: '/settings', labelKey: 'web.nav.settings' as const },
];

export default function Layout() {
  const { t } = useSettings();

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--app-bg)' }}>
      <header
        style={{
          background: 'var(--app-surface)',
          color: 'var(--app-text)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 24,
          flexWrap: 'wrap',
          padding: '0 24px',
          borderBottom: '1px solid var(--app-border)',
          minHeight: 72,
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap', flex: '1 1 480px' }}>
          <span style={{ fontWeight: 800, fontSize: 16 }}>{t('app.name')}</span>
          <nav style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                style={({ isActive }) => ({
                  color: isActive ? 'var(--app-primary)' : 'var(--app-text-muted)',
                  textDecoration: 'none',
                  padding: '6px 12px',
                  borderRadius: 999,
                  background: isActive ? 'var(--app-primary-soft)' : 'transparent',
                  border: isActive ? '1px solid var(--app-primary)' : '1px solid transparent',
                  fontWeight: 700,
                })}
              >
                {t(item.labelKey)}
              </NavLink>
            ))}
          </nav>
        </div>
        <QuickSettingsControls />
      </header>
      <main style={{ flex: 1 }}>
        <Outlet />
      </main>
    </div>
  );
}
