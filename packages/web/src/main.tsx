import { Suspense, StrictMode, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import AdminLayout from './components/AdminLayout';
import RequireUserAuth from './components/RequireUserAuth';
import { SettingsProvider } from './context/settings';

const TodayPage = lazy(() => import('./pages/TodayPage'));
const ReportPage = lazy(() => import('./pages/ReportPage'));
const ExperimentsPage = lazy(() => import('./pages/ExperimentsPage'));
const AdminOperationsPage = lazy(() => import('./pages/AdminOperationsPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));

function RouteFallback() {
  return (
    <div
      style={{
        minHeight: '40vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#64748b',
        fontSize: 14,
      }}
    >
      화면을 불러오는 중...
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SettingsProvider>
      <BrowserRouter>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<RequireUserAuth />}>
              <Route path="/" element={<Layout />}>
                <Route index element={<Navigate to="/today" replace />} />
                <Route path="today" element={<TodayPage />} />
                <Route path="report" element={<ReportPage />} />
                <Route path="experiments" element={<ExperimentsPage />} />
                <Route path="settings" element={<SettingsPage />} />
              </Route>
            </Route>
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<Navigate to="/admin/operations" replace />} />
              <Route path="operations" element={<AdminOperationsPage />} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </SettingsProvider>
  </StrictMode>
);
