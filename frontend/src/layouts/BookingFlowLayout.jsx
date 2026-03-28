import { Link, Outlet, useParams } from "react-router-dom";
import { useAsync } from "../hooks/useAsync.js";
import { getBusinessBySlug } from "../lib/api.js";
import BookingLayout from "./BookingLayout.jsx";
import { LoadingState, ErrorState } from "../components/ui.jsx";
import { BookingProvider } from "../context/BookingContext.jsx";

function bookingLoadMessage(error) {
  const m = error?.message ?? "";
  if (error?.code === "auth_required" || /Требуется войти/i.test(m)) {
    return "Войдите в аккаунт владельца салона, чтобы открыть страницу записи (данные недоступны без входа).";
  }
  return m || "Салон не найден или slug не совпадает с вашим бизнесом.";
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
    const needLogin = error?.code === "auth_required" || /Требуется войти/i.test(error?.message ?? "");
    return (
      <BookingLayout>
        <ErrorState message={bookingLoadMessage(error)} />
        {needLogin && (
          <p className="text-center mt-4 text-sm text-violet-600 dark:text-violet-400">
            <Link to="/login" className="font-medium underline">
              Перейти ко входу
            </Link>
          </p>
        )}
      </BookingLayout>
    );
  }

  return (
    <BookingProvider business={business} slug={slug}>
      <Outlet />
    </BookingProvider>
  );
}
