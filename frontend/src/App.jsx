// ============================================
// ГЛАВНЫЙ ФАЙЛ ПРИЛОЖЕНИЯ
// Здесь настроен роутинг — все URL и страницы
// ============================================

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

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
  ClientsPage,
  ClientProfile,
  ServicesPage,
  ServiceEditor,
  StaffPage,
  StaffProfile,
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

        {/* ---- Публичная зона (без layout обёртки, у каждой страницы свой BookingLayout) ---- */}
        <Route path="/book/:slug"    element={<BookingLanding />} />
        <Route path="/book/services" element={<ServiceSelection />} />
        <Route path="/book/staff"    element={<StaffSelection />} />
        <Route path="/book/calendar" element={<DateTimeSelection />} />
        <Route path="/book/details"  element={<ClientDetails />} />
        <Route path="/book/confirm"  element={<BookingConfirm />} />
        <Route path="/book/success"  element={<BookingSuccess />} />

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
          path="/appointments/:id"
          element={<DashboardLayout><AppointmentDetail /></DashboardLayout>}
        />
        <Route
          path="/clients"
          element={<DashboardLayout><ClientsPage /></DashboardLayout>}
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
