import { useNavigate } from "react-router-dom";
import { useSelectedRequester } from "../../context/RequesterContext.js";

export function RequesterBadge() {
  const { requester, clearRequester } = useSelectedRequester();
  const navigate = useNavigate();

  if (!requester) return null;

  function handleSwitch() {
    clearRequester();
    navigate("/select-requester");
  }

  return (
    <div className="d-flex align-items-center gap-2 text-white">
      <span>{requester.fullName}</span>
      <button type="button" className="btn btn-sm btn-outline-light" onClick={handleSwitch}>
        Switch requester
      </button>
    </div>
  );
}
