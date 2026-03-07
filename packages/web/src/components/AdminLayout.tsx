import { NavLink, Outlet } from 'react-router-dom';

const NAV_ITEMS = [
  { to: '/admin/operations', label: '운영 작업' },
];

export default function AdminLayout() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#f8fafc' }}>
      <header style={{
        background: '#111827',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 24,
        padding: '0 24px',
        height: 56,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
          <span style={{ fontWeight: 700, fontSize: 16, letterSpacing: '-0.3px' }}>
            운영 콘솔
          </span>
          <nav style={{ display: 'flex', gap: 6 }}>
            {NAV_ITEMS.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                style={({ isActive }) => ({
                  color: isActive ? '#bfdbfe' : '#d1d5db',
                  textDecoration: 'none',
                  padding: '6px 12px',
                  borderRadius: 6,
                  fontSize: 14,
                  background: isActive ? 'rgba(59,130,246,.16)' : 'transparent',
                  fontWeight: isActive ? 600 : 400,
                })}
              >
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
        <NavLink
          to="/today"
          style={{
            color: '#d1d5db',
            textDecoration: 'none',
            fontSize: 13,
            padding: '6px 10px',
            borderRadius: 6,
            border: '1px solid rgba(255,255,255,.12)',
          }}
        >
          사용자 대시보드로 돌아가기
        </NavLink>
      </header>
      <main style={{ flex: 1 }}>
        <Outlet />
      </main>
    </div>
  );
}
