import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import TodayPage from './pages/TodayPage';
import ReportPage from './pages/ReportPage';
import ExperimentsPage from './pages/ExperimentsPage';
createRoot(document.getElementById('root')).render(_jsx(StrictMode, { children: _jsx(BrowserRouter, { children: _jsx(Routes, { children: _jsxs(Route, { path: "/", element: _jsx(Layout, {}), children: [_jsx(Route, { index: true, element: _jsx(Navigate, { to: "/today", replace: true }) }), _jsx(Route, { path: "today", element: _jsx(TodayPage, {}) }), _jsx(Route, { path: "report", element: _jsx(ReportPage, {}) }), _jsx(Route, { path: "experiments", element: _jsx(ExperimentsPage, {}) })] }) }) }) }));
