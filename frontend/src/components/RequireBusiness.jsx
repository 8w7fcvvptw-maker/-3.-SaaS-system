import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

/** После входа без строки в businesses — на /onboarding */
export function RequireBusiness({ children }) {
  const { user, loading: authLoading, userType, isAdmin, hasBusiness } = useAuth();
  const shouldRequireBusiness = userType === "owner" && !isAdmin;

  if (authLoading || (user && !isAdmin && userType == null)) {
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

  if (user && shouldRequireBusiness && !hasBusiness) {
    return <Navigate to="/onboarding" replace />;
  }

  return children;
}
