import { Navigate, useLocation } from "react-router-dom";
import { useSubscription } from "../hooks/useSubscription.js";

export function RequireAdmin({ children }) {
  const location = useLocation();
  const { loading, profile, isAdmin } = useSubscription();

  if (loading) {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-busy="true"
        className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-zinc-900 text-gray-600 dark:text-gray-400 text-sm"
      >
        Загрузка…
      </div>
    );
  }

  if (!profile) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
