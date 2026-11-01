import { request } from "./client.js";

export type ActionStatus = "PLANNED" | "COMPLETED" | "CANCELLED";

interface PersonRef {
  id: number;
  fullName: string;
}

// docs/lab-04/api-spec.md "Action Taken object".
export interface ActionTaken {
  id: number;
  ticketId: number;
  status: ActionStatus;
  actionDateTime: string;
  description: string;
  result: string | null;
  followUpRequired: boolean;
  followUpNote: string | null;
  attachmentNotes: string | null;
  assignee: PersonRef;
  createdBy: PersonRef;
  performedBy: PersonRef | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateActionBody {
  description: string;
  actionDateTime?: string;
  assigneeId?: number;
  status?: "PLANNED" | "COMPLETED";
  result?: string | null;
  followUpRequired?: boolean;
  followUpNote?: string | null;
  attachmentNotes?: string | null;
  // BR-21: one id per opened form, reused on a retry, so a double click or a network retry cannot
  // create the action twice.
  clientRequestId: string;
}

export interface UpdateActionBody {
  version: number;
  description?: string;
  actionDateTime?: string;
  assigneeId?: number;
  status?: ActionStatus;
  result?: string | null;
  followUpRequired?: boolean;
  followUpNote?: string | null;
  attachmentNotes?: string | null;
}

export function listActions(ticketId: number): Promise<ActionTaken[]> {
  return request<ActionTaken[]>(`/api/tickets/${ticketId}/actions`);
}

export function createAction(ticketId: number, body: CreateActionBody): Promise<ActionTaken> {
  return request<ActionTaken>(`/api/tickets/${ticketId}/actions`, { method: "POST", body });
}

export function updateAction(ticketId: number, actionId: number, body: UpdateActionBody): Promise<ActionTaken> {
  return request<ActionTaken>(`/api/tickets/${ticketId}/actions/${actionId}`, { method: "PATCH", body });
}
