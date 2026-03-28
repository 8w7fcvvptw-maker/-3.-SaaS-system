import { RequireAuth } from "../components/RequireAuth.jsx";
import { RequireBusiness } from "../components/RequireBusiness.jsx";
import DashboardLayout from "./DashboardLayout.jsx";

export default function DashboardShell({ children }) {
  return (
    <RequireAuth>
      <RequireBusiness>
        <DashboardLayout>{children}</DashboardLayout>
      </RequireBusiness>
    </RequireAuth>
  );
}
