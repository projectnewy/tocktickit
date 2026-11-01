const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

// BR-33: a 401 from any feature call means the session ended. The auth provider registers a handler that clears
// the signed-in user (the route guard then returns to Login with a message). /api/auth/* calls are excluded: a
// wrong password or wrong current password is also a 401, and must show its own message instead.
let unauthorizedHandler: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

function notifyIfSessionEnded(path: string, status: number) {
  if (status === 401 && !path.startsWith("/api/auth/")) unauthorizedHandler?.();
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};

  let body: BodyInit | undefined;
  if (options.body instanceof FormData) {
    // Leave Content-Type unset — the browser adds the multipart boundary itself.
    body = options.body;
  } else if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.body);
  }

  const res = await fetch(`${API_URL}${path}`, {
    method: options.method ?? "GET",
    headers,
    body,
    signal: options.signal,
    // Required for the httpOnly tk_session cookie to be sent/stored —
    // without this, the browser drops Set-Cookie on the login response and
    // never attaches the cookie to later requests, since the API and the
    // Vite dev server are different origins (ports).
    credentials: "include",
  });

  if (!res.ok) {
    let parsed: unknown;
    try {
      parsed = await res.json();
    } catch {
      parsed = undefined;
    }
    const message =
      (parsed as { error?: string } | undefined)?.error ?? `Request failed with status ${res.status}`;
    notifyIfSessionEnded(path, res.status);
    throw new ApiError(res.status, message, parsed);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// Attachment downloads need the auth cookie too, so a plain <a href> that
// bypasses fetch() can't be relied on to carry credentials consistently —
// fetch the bytes as a blob and hand them to the caller, which triggers the
// save via an object URL.
export async function requestBlob(path: string): Promise<Blob> {
  const res = await fetch(`${API_URL}${path}`, { credentials: "include" });

  if (!res.ok) {
    let parsed: unknown;
    try {
      parsed = await res.json();
    } catch {
      parsed = undefined;
    }
    const message =
      (parsed as { error?: string } | undefined)?.error ?? `Request failed with status ${res.status}`;
    notifyIfSessionEnded(path, res.status);
    throw new ApiError(res.status, message, parsed);
  }

  return res.blob();
}
