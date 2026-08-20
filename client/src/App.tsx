import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { RequesterProvider } from "./context/RequesterContext.js";
import { RequesterGuard } from "./components/layout/RequesterGuard.js";
import { AppShell } from "./components/layout/AppShell.js";
import RequesterSelection from "./pages/RequesterSelection.js";
import CreateTicket from "./pages/CreateTicket.js";
import SystemCheck from "./pages/SystemCheck.js";
import NotFound from "./pages/NotFound.js";

// My Tickets and Ticket Detail placeholders are replaced by their real
// screens in Issues 12–13.
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
                  <p className="text-secondary">My Tickets — coming in Issue 11.</p>
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
