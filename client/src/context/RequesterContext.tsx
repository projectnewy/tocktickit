import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { setCurrentRequesterId } from "../api/client.js";
import { listRequesters } from "../api/reference.js";
import type { Requester } from "../api/types.js";

const STORAGE_KEY = "toktickit.selectedRequester";
const STORAGE_VERSION = 1;

interface StoredSelection {
  v: number;
  requester: Requester;
}

interface RequesterContextValue {
  requester: Requester | null;
  isBootstrapping: boolean;
  selectRequester: (requester: Requester) => void;
  clearRequester: () => void;
}

const RequesterContext = createContext<RequesterContextValue | undefined>(undefined);

function readStoredSelection(): Requester | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredSelection;
    if (parsed.v !== STORAGE_VERSION || !parsed.requester) return null;
    return parsed.requester;
  } catch {
    return null;
  }
}

function writeStoredSelection(requester: Requester | null): void {
  if (requester === null) {
    localStorage.removeItem(STORAGE_KEY);
    return;
  }
  const payload: StoredSelection = { v: STORAGE_VERSION, requester };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export function RequesterProvider({ children }: { children: ReactNode }) {
  const [requester, setRequester] = useState<Requester | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      const stored = readStoredSelection();
      if (!stored) {
        setIsBootstrapping(false);
        return;
      }
      // Re-validate against the server: an inactive requester (or one that
      // no longer exists) must not stay "selected" from a stale entry.
      try {
        const active = await listRequesters();
        if (cancelled) return;
        const stillActive = active.find((r) => r.id === stored.id);
        if (stillActive) {
          setCurrentRequesterId(stillActive.id);
          setRequester(stillActive);
        } else {
          writeStoredSelection(null);
        }
      } catch {
        if (!cancelled) writeStoredSelection(null);
      } finally {
        if (!cancelled) setIsBootstrapping(false);
      }
    }

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  function selectRequester(next: Requester) {
    setCurrentRequesterId(next.id);
    setRequester(next);
    writeStoredSelection(next);
  }

  function clearRequester() {
    setCurrentRequesterId(null);
    setRequester(null);
    writeStoredSelection(null);
  }

  return (
    <RequesterContext.Provider value={{ requester, isBootstrapping, selectRequester, clearRequester }}>
      {children}
    </RequesterContext.Provider>
  );
}

export function useSelectedRequester(): RequesterContextValue {
  const ctx = useContext(RequesterContext);
  if (!ctx) throw new Error("useSelectedRequester must be used within a RequesterProvider");
  return ctx;
}
