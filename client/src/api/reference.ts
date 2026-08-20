import { request } from "./client.js";
import type { Category, RelatedSystem, Requester } from "./types.js";

// No X-Requester-Id required — the Selection screen calls listRequesters()
// before any requester has been chosen.
export function listCategories(): Promise<Category[]> {
  return request<Category[]>("/api/categories");
}

export function listRelatedSystems(): Promise<RelatedSystem[]> {
  return request<RelatedSystem[]>("/api/related-systems");
}

export function listRequesters(): Promise<Requester[]> {
  return request<Requester[]>("/api/requesters");
}
