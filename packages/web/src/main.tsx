import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import TodayPage from './pages/TodayPage';
import ReportPage from './pages/ReportPage';
import ExperimentsPage from './pages/ExperimentsPage';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/today" replace />} />
          <Route path="today"       element={<TodayPage />} />
          <Route path="report"      element={<ReportPage />} />
          <Route path="experiments" element={<ExperimentsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>
);
