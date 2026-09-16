import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext.js";
import { AuthGuard, RequireAuth, RoleGuard } from "./components/layout/AuthGuard.js";
import { AppShell } from "./components/layout/AppShell.js";
import Login from "./pages/Login.js";
import ChangePassword from "./pages/ChangePassword.js";
import CreateTicket from "./pages/CreateTicket.js";
import MyTickets from "./pages/MyTickets.js";
import RequesterTicketDetail from "./pages/RequesterTicketDetail.js";
import StaffTicketQueue from "./pages/StaffTicketQueue.js";
import StaffTicketDetail from "./pages/StaffTicketDetail.js";
import UserManagement from "./pages/UserManagement.js";
import SystemCheck from "./pages/SystemCheck.js";
import NotFound from "./pages/NotFound.js";
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Navigate to="/tickets" replace />} />
          <Route path="/login" element={<Login />} />
          <Route
            path="/change-password"
            element={
              <RequireAuth>
                <ChangePassword />
              </RequireAuth>
            }
          />
          <Route
            path="/tickets"
            element={
              <AuthGuard>
                <AppShell>
                  <MyTickets />
                </AppShell>
              </AuthGuard>
            }
          />
          <Route
            path="/tickets/new"
            element={
              <AuthGuard>
                <AppShell>
                  <CreateTicket />
                </AppShell>
              </AuthGuard>
            }
          />
          <Route
            path="/tickets/:ticketId"
            element={
              <AuthGuard>
                <AppShell>
                  <RequesterTicketDetail />
                </AppShell>
              </AuthGuard>
            }
          />
          <Route
            path="/staff/tickets"
            element={
              <AuthGuard>
                <RoleGuard allowed={["IT_STAFF", "ADMINISTRATOR"]}>
                  <AppShell>
                    <StaffTicketQueue />
                  </AppShell>
                </RoleGuard>
              </AuthGuard>
            }
          />
          <Route
            path="/staff/tickets/:ticketId"
            element={
              <AuthGuard>
                <RoleGuard allowed={["IT_STAFF", "ADMINISTRATOR"]}>
                  <AppShell>
                    <StaffTicketDetail />
                  </AppShell>
                </RoleGuard>
              </AuthGuard>
            }
          />
          <Route
            path="/admin/users"
            element={
              <AuthGuard>
                <RoleGuard allowed={["ADMINISTRATOR"]}>
                  <AppShell>
                    <UserManagement />
                  </AppShell>
                </RoleGuard>
              </AuthGuard>
            }
          />
          <Route
            path="/system"
            element={
              <AppShell>
                <SystemCheck />
              </AppShell>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
