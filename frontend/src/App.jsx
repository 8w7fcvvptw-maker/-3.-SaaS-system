// ============================================
// ГЛАВНЫЙ ФАЙЛ ПРИЛОЖЕНИЯ — роутинг
// ============================================

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import { AuthApiBridge } from "./components/AuthApiBridge.jsx";

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

export default function App() {
  return (
    <BrowserRouter>
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

        <Route path="/admin" element={<Navigate to="/dashboard" replace />} />
        <Route path="/admin/*" element={<Navigate to="/dashboard" replace />} />

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
