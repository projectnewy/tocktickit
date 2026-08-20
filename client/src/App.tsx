import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { RequesterProvider } from "./context/RequesterContext.js";
import { RequesterGuard } from "./components/layout/RequesterGuard.js";
import { AppShell } from "./components/layout/AppShell.js";
import RequesterSelection from "./pages/RequesterSelection.js";
import CreateTicket from "./pages/CreateTicket.js";
import MyTickets from "./pages/MyTickets.js";
import RequesterTicketDetail from "./pages/RequesterTicketDetail.js";
import SystemCheck from "./pages/SystemCheck.js";
import NotFound from "./pages/NotFound.js";
export default function App() {
  return (
    <BrowserRouter>
      <RequesterProvider>
        <Routes>
          <Route path="/" element={<Navigate to="/tickets" replace />} />
          <Route path="/select-requester" element={<RequesterSelection />} />
          <Route
            path="/tickets"
            element={
              <RequesterGuard>
                <AppShell>
                  <MyTickets />
                </AppShell>
              </RequesterGuard>
            }
          />
          <Route
            path="/tickets/new"
            element={
              <RequesterGuard>
                <AppShell>
                  <CreateTicket />
                </AppShell>
              </RequesterGuard>
            }
          />
          <Route
            path="/tickets/:ticketId"
            element={
              <RequesterGuard>
                <AppShell>
                  <RequesterTicketDetail />
                </AppShell>
              </RequesterGuard>
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
      </RequesterProvider>
    </BrowserRouter>
  );
}
