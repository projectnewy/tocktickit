import { useState } from "react";
import { checkSystem, Category } from "../api.js";

// UI states from Issue 4 (Lab 1). Preserved as-is; moved here from App.tsx
// when App.tsx became the router shell for Lab 2 — see /system route.
type UiState = "idle" | "loading" | "success" | "error";

export default function SystemCheck() {
  const [state, setState] = useState<UiState>("idle");
  const [categories, setCategories] = useState<Category[]>([]);

  async function handleCheck() {
    setState("loading");
    try {
      const result = await checkSystem();
      setCategories(result.categories);
      setState("success");
    } catch {
      setState("error");
    }
  }

  return (
    <div className="container py-5" style={{ maxWidth: 640 }}>
      <h1 className="h3 mb-4">
        TokTickIT <span className="text-success">IT Service Desk</span>
      </h1>

      <button className="btn btn-success" onClick={handleCheck} disabled={state === "loading"}>
        {state === "loading" ? "⏳ Loading…" : "Check System"}
      </button>

      {state === "success" && (
        <div className="mt-4">
          <p className="mb-2">
            <strong>System Status:</strong> <span className="text-success">Online</span>
          </p>
          {categories.length > 0 && (
            <>
              <p className="mb-1">
                <strong>Supported Request Categories:</strong>
              </p>
              <ul>
                {categories.map((category) => (
                  <li key={category.id}>{category.name}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {state === "error" && (
        <div className="mt-4">
          <p className="mb-1">
            <strong>System Status:</strong> <span className="text-danger">Offline</span>
          </p>
          <p className="text-danger mb-0">Unable to connect to TokTickIT API</p>
        </div>
      )}
    </div>
  );
}
