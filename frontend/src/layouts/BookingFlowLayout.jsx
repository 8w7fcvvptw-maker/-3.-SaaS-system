import { Link, Outlet, useParams } from "react-router-dom";
import { useAsync } from "../hooks/useAsync.js";
import { getBusinessBySlug } from "../lib/api.js";
import BookingLayout from "./BookingLayout.jsx";
import { LoadingState, ErrorState } from "../components/ui.jsx";
import { BookingProvider } from "../context/BookingContext.jsx";

function bookingLoadMessage(error) {
  const m = error?.message ?? "";
  if (error?.code === "auth_required" || /Требуется войти/i.test(m)) {
    return "Не удалось загрузить данные салона. Проверьте ссылку или попробуйте позже.";
  }
  return m || "Салон не найден. Проверьте адрес в ссылке.";
}

export default function BookingFlowLayout() {
  const { slug } = useParams();
  const { data: business, loading, error } = useAsync(
    () => getBusinessBySlug(slug),
    true,
    [slug]
  );

  if (loading) {
    return (
      <BookingLayout>
        <LoadingState />
      </BookingLayout>
    );
  }
  if (error || !business?.id) {
    return (
      <BookingLayout>
        <ErrorState message={bookingLoadMessage(error)} />
        <p className="text-center mt-4 text-sm text-gray-500 dark:text-zinc-400">
          <Link to="/login" className="font-medium text-slate-700 dark:text-zinc-300 underline underline-offset-2">
            Вход для владельца
          </Link>
        </p>
      </BookingLayout>
    );
  }

  return (
    <BookingProvider business={business} slug={slug}>
      <Outlet />
    </BookingProvider>
  );
}
