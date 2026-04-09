import { RequireAuth } from "../components/RequireAuth.jsx";
import { RequireBusiness } from "../components/RequireBusiness.jsx";
import SubscriptionGuard from "../components/SubscriptionGuard.jsx";
import DashboardLayout from "./DashboardLayout.jsx";

export default function DashboardShell({ children }) {
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
