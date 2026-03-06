import { NavLink, Outlet } from 'react-router-dom';

const NAV_ITEMS = [
  { to: '/today',       label: '오늘 할 일' },
  { to: '/report',      label: '주간 리포트' },
  { to: '/experiments', label: '실험 현황' },
];

export default function Layout() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{
        background: '#1e293b', color: '#fff',
        display: 'flex', alignItems: 'center', gap: 32,
        padding: '0 24px', height: 52,
      }}>
        <span style={{ fontWeight: 700, fontSize: 16, letterSpacing: '-0.3px' }}>
          🇯🇵 일본어 학습 대시보드
        </span>
        <nav style={{ display: 'flex', gap: 4 }}>
          {NAV_ITEMS.map(({ to, label }) => (
            <NavLink
              key={to} to={to}
              style={({ isActive }) => ({
                color: isActive ? '#a5b4fc' : '#cbd5e1',
                textDecoration: 'none',
                padding: '4px 12px',
                borderRadius: 6,
                fontSize: 14,
                background: isActive ? 'rgba(99,102,241,.2)' : 'transparent',
                fontWeight: isActive ? 600 : 400,
              })}
            >
              {label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main style={{ flex: 1 }}>
        <Outlet />
      </main>
    </div>
  );
}
