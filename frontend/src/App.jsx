// ============================================
// ГЛАВНЫЙ ФАЙЛ ПРИЛОЖЕНИЯ
// Здесь настроен роутинг — все URL и страницы
// ============================================

import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";

// Context
import { BookingProvider } from "./context/BookingContext";

// Layouts
import DashboardLayout from "./layouts/DashboardLayout";
import AdminLayout from "./layouts/AdminLayout";

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

// Страницы кабинета бизнеса
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

// Admin SaaS страницы
import {
  AdminDashboard,
  AdminBusinesses,
  AdminPlans,
} from "./pages/admin/AdminPages";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* ---- Публичная зона (BookingProvider общий для потока записи) ---- */}
        <Route path="/book/:slug" element={<BookingLanding />} />
        <Route path="/book" element={<BookingProvider><Outlet /></BookingProvider>}>
          <Route path="services" element={<ServiceSelection />} />
          <Route path="staff"    element={<StaffSelection />} />
          <Route path="calendar" element={<DateTimeSelection />} />
          <Route path="details"  element={<ClientDetails />} />
          <Route path="confirm"  element={<BookingConfirm />} />
          <Route path="success"  element={<BookingSuccess />} />
        </Route>

        {/* ---- Кабинет бизнеса (обёрнут в DashboardLayout) ---- */}
        <Route
          path="/dashboard"
          element={<DashboardLayout><Dashboard /></DashboardLayout>}
        />
        <Route
          path="/calendar"
          element={<DashboardLayout><CalendarPage /></DashboardLayout>}
        />
        <Route
          path="/appointments"
          element={<DashboardLayout><AppointmentsList /></DashboardLayout>}
        />
        <Route
          path="/appointments/new"
          element={<DashboardLayout><AppointmentEditor /></DashboardLayout>}
        />
        <Route
          path="/appointments/:id"
          element={<DashboardLayout><AppointmentDetail /></DashboardLayout>}
        />
        <Route
          path="/clients"
          element={<DashboardLayout><ClientsPage /></DashboardLayout>}
        />
        <Route
          path="/clients/new"
          element={<DashboardLayout><ClientEditor /></DashboardLayout>}
        />
        <Route
          path="/clients/:id"
          element={<DashboardLayout><ClientProfile /></DashboardLayout>}
        />
        <Route
          path="/services"
          element={<DashboardLayout><ServicesPage /></DashboardLayout>}
        />
        <Route
          path="/services/:id"
          element={<DashboardLayout><ServiceEditor /></DashboardLayout>}
        />
        <Route
          path="/staff"
          element={<DashboardLayout><StaffPage /></DashboardLayout>}
        />
        <Route
          path="/staff/new"
          element={<DashboardLayout><StaffEditor /></DashboardLayout>}
        />
        <Route
          path="/staff/:id"
          element={<DashboardLayout><StaffProfile /></DashboardLayout>}
        />
        <Route
          path="/messages"
          element={<DashboardLayout><MessagesPage /></DashboardLayout>}
        />
        <Route
          path="/analytics"
          element={<DashboardLayout><AnalyticsPage /></DashboardLayout>}
        />
        <Route
          path="/settings"
          element={<DashboardLayout><SettingsPage /></DashboardLayout>}
        />

        {/* ---- Admin SaaS (обёрнут в AdminLayout) ---- */}
        <Route
          path="/admin"
          element={<AdminLayout><AdminDashboard /></AdminLayout>}
        />
        <Route
          path="/admin/businesses"
          element={<AdminLayout><AdminBusinesses /></AdminLayout>}
        />
        <Route
          path="/admin/plans"
          element={<AdminLayout><AdminPlans /></AdminLayout>}
        />

        {/* По умолчанию — редирект на дашборд */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />

      </Routes>
    </BrowserRouter>
  );
}
