// ============================================
// ГЛАВНЫЙ ФАЙЛ ПРИЛОЖЕНИЯ — роутинг
// ============================================

import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { trackPageView } from "./lib/monitoring.js";

import { AuthApiBridge } from "./components/AuthApiBridge.jsx";
import { RequireAdmin } from "./components/RequireAdmin.jsx";

// Страницы записи (публичная зона)
import {
  BookingLanding,
  ServiceSelection,
  StaffSelection,
  DateTimeSelection,
  ClientDetails,
  BookingConfirm,
  BookingSuccess,
} from "./pages/booking/BookingPages";

import BookingFlowLayout from "./layouts/BookingFlowLayout.jsx";

import DashboardShell from "./layouts/DashboardShell.jsx";
import AdminLayout from "./layouts/AdminLayout.jsx";

import {
  Dashboard,
  CalendarPage,
  AppointmentsList,
  AppointmentDetail,
  AppointmentEditor,
  ClientsPage,
  ClientProfile,
  ClientEditor,
  ServicesPage,
  ServiceEditor,
  StaffPage,
  StaffProfile,
  StaffEditor,
  MessagesPage,
  AnalyticsPage,
  SettingsPage,
} from "./pages/dashboard/DashboardPages";

import { LoginPage, RegisterPage, OnboardingPage } from "./pages/auth/AuthPages.jsx";
import { AdminDashboard, AdminBusinesses, AdminPlans } from "./pages/admin/AdminPages.jsx";

function MetrikaRouteTracker() {
  const location = useLocation();

  useEffect(() => {
    trackPageView(`${location.pathname}${location.search}`);
  }, [location.pathname, location.search]);

  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <MetrikaRouteTracker />
      <AuthApiBridge />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/onboarding" element={<OnboardingPage />} />

        <Route path="/book/:slug" element={<BookingFlowLayout />}>
          <Route index element={<BookingLanding />} />
          <Route path="services" element={<ServiceSelection />} />
          <Route path="staff" element={<StaffSelection />} />
          <Route path="calendar" element={<DateTimeSelection />} />
          <Route path="details" element={<ClientDetails />} />
          <Route path="confirm" element={<BookingConfirm />} />
          <Route path="success" element={<BookingSuccess />} />
        </Route>

        <Route
          path="/dashboard"
          element={
            <DashboardShell>
              <Dashboard />
            </DashboardShell>
          }
        />
        <Route
          path="/calendar"
          element={
            <DashboardShell>
              <CalendarPage />
            </DashboardShell>
          }
        />
        <Route
          path="/appointments"
          element={
            <DashboardShell>
              <AppointmentsList />
            </DashboardShell>
          }
        />
        <Route
          path="/appointments/new"
          element={
            <DashboardShell>
              <AppointmentEditor />
            </DashboardShell>
          }
        />
        <Route
          path="/appointments/:id"
          element={
            <DashboardShell>
              <AppointmentDetail />
            </DashboardShell>
          }
        />
        <Route
          path="/clients"
          element={
            <DashboardShell>
              <ClientsPage />
            </DashboardShell>
          }
        />
        <Route
          path="/clients/new"
          element={
            <DashboardShell>
              <ClientEditor />
            </DashboardShell>
          }
        />
        <Route
          path="/clients/:id"
          element={
            <DashboardShell>
              <ClientProfile />
            </DashboardShell>
          }
        />
        <Route
          path="/services"
          element={
            <DashboardShell>
              <ServicesPage />
            </DashboardShell>
          }
        />
        <Route
          path="/services/:id"
          element={
            <DashboardShell>
              <ServiceEditor />
            </DashboardShell>
          }
        />
        <Route
          path="/staff"
          element={
            <DashboardShell>
              <StaffPage />
            </DashboardShell>
          }
        />
        <Route
          path="/staff/new"
          element={
            <DashboardShell>
              <StaffEditor />
            </DashboardShell>
          }
        />
        <Route
          path="/staff/:id"
          element={
            <DashboardShell>
              <StaffProfile />
            </DashboardShell>
          }
        />
        <Route
          path="/messages"
          element={
            <DashboardShell>
              <MessagesPage />
            </DashboardShell>
          }
        />
        <Route
          path="/analytics"
          element={
            <DashboardShell>
              <AnalyticsPage />
            </DashboardShell>
          }
        />
        <Route
          path="/settings"
          element={
            <DashboardShell>
              <SettingsPage />
            </DashboardShell>
          }
        />

        <Route
          path="/admin"
          element={
            <RequireAdmin>
              <AdminLayout>
                <AdminDashboard />
              </AdminLayout>
            </RequireAdmin>
          }
        />
        <Route
          path="/admin/businesses"
          element={
            <RequireAdmin>
              <AdminLayout>
                <AdminBusinesses />
              </AdminLayout>
            </RequireAdmin>
          }
        />
        <Route
          path="/admin/plans"
          element={
            <RequireAdmin>
              <AdminLayout>
                <AdminPlans />
              </AdminLayout>
            </RequireAdmin>
          }
        />
        <Route path="/admin/*" element={<Navigate to="/admin" replace />} />

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
