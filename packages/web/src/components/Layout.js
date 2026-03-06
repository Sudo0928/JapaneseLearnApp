import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { NavLink, Outlet } from 'react-router-dom';
const NAV_ITEMS = [
    { to: '/today', label: '오늘 할 일' },
    { to: '/report', label: '주간 리포트' },
    { to: '/experiments', label: '실험 현황' },
];
export default function Layout() {
    return (_jsxs("div", { style: { minHeight: '100vh', display: 'flex', flexDirection: 'column' }, children: [_jsxs("header", { style: {
                    background: '#1e293b', color: '#fff',
                    display: 'flex', alignItems: 'center', gap: 32,
                    padding: '0 24px', height: 52,
                }, children: [_jsx("span", { style: { fontWeight: 700, fontSize: 16, letterSpacing: '-0.3px' }, children: "\uD83C\uDDEF\uD83C\uDDF5 \uC77C\uBCF8\uC5B4 \uD559\uC2B5 \uB300\uC2DC\uBCF4\uB4DC" }), _jsx("nav", { style: { display: 'flex', gap: 4 }, children: NAV_ITEMS.map(({ to, label }) => (_jsx(NavLink, { to: to, style: ({ isActive }) => ({
                                color: isActive ? '#a5b4fc' : '#cbd5e1',
                                textDecoration: 'none',
                                padding: '4px 12px',
                                borderRadius: 6,
                                fontSize: 14,
                                background: isActive ? 'rgba(99,102,241,.2)' : 'transparent',
                                fontWeight: isActive ? 600 : 400,
                            }), children: label }, to))) })] }), _jsx("main", { style: { flex: 1 }, children: _jsx(Outlet, {}) })] }));
}
