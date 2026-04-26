import { Navigate } from "react-router-dom";
import { RequireAuth } from "../components/RequireAuth.jsx";
import { RequireBusiness } from "../components/RequireBusiness.jsx";
import SubscriptionGuard from "../components/SubscriptionGuard.jsx";
import DashboardLayout from "./DashboardLayout.jsx";
import { useAuth } from "../context/AuthContext.jsx";

export default function DashboardShell({ children }) {
  const { isAdmin } = useAuth();
  if (isAdmin) {
    return <Navigate to="/admin" replace />;
  }

  return (
    <RequireAuth>
      <RequireBusiness>
        <SubscriptionGuard>
          <DashboardLayout>{children}</DashboardLayout>
        </SubscriptionGuard>
      </RequireBusiness>
    </RequireAuth>
  );
}
