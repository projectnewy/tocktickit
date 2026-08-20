import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useSelectedRequester } from "../../context/RequesterContext.js";
import { Spinner } from "../ui/Spinner.js";

export function RequesterGuard({ children }: { children: ReactNode }) {
  const { requester, isBootstrapping } = useSelectedRequester();
  const location = useLocation();

  if (isBootstrapping) {
    // Not a redirect: a hard refresh on /tickets/5 should wait for the
    // localStorage bootstrap, not bounce straight to the selector.
    return (
      <div className="d-flex justify-content-center py-5">
        <Spinner />
      </div>
    );
  }

  if (!requester) {
    return <Navigate to="/select-requester" replace state={{ from: location }} />;
  }

  return <>{children}</>;
}
