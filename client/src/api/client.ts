const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

// Module-scoped, not React state — bridges RequesterContext to the plain,
// spy-able api modules without threading requesterId through every call
// site. In Lab 3 this becomes the access token.
let currentRequesterId: number | null = null;

export function setCurrentRequesterId(id: number | null): void {
  currentRequesterId = id;
}

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (currentRequesterId !== null) headers["X-Requester-Id"] = String(currentRequesterId);

  let body: string | undefined;
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.body);
  }

  const res = await fetch(`${API_URL}${path}`, {
    method: options.method ?? "GET",
    headers,
    body,
    signal: options.signal,
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
    throw new ApiError(res.status, message, parsed);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
