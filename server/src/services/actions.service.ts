import { Prisma, type ActionStatus, type Role, type TicketStatus } from "@prisma/client";
import { ZodError, ZodIssueCode } from "zod";
import { getPrisma } from "../prisma.js";
import { AppError, NotFoundError, UnprocessableEntityError } from "../http/errors.js";
import { canTransition, editableFieldsFor, normalizeFollowUp, validateActionFields, type ActionFieldErrors } from "./actionRules.js";
import type { CreateActionInput, UpdateActionInput } from "../validation/action.schemas.js";
import { lockTicket } from "./ticketLock.js";

// BR-05: actions are created or changed only while the Ticket is being worked.
const ACTIONABLE: TicketStatus[] = ["OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "REOPENED"];
const ASSIGNABLE_ROLES: Role[] = ["IT_STAFF", "ADMINISTRATOR"];

const person = { select: { id: true, fullName: true } } as const;
const actionSelect = {
  id: true,
  ticketId: true,
  status: true,
  actionDateTime: true,
  description: true,
  result: true,
  followUpRequired: true,
  followUpNote: true,
  attachmentNotes: true,
  version: true,
  createdAt: true,
  updatedAt: true,
  assignee: person,
  createdBy: person,
  performedBy: person,
} satisfies Prisma.ActionTakenSelect;

const trimmedOrNull = (value: string | null | undefined) => {
  const text = (value ?? "").trim();
  return text.length > 0 ? text : null;
};

// Business-rule failures reuse the zod error shape ({ error, details: [{ field, message }] }) so the
// client handles one 400 format for both kinds of validation.
function throwFieldErrors(errors: ActionFieldErrors): never {
  throw new ZodError(
    Object.entries(errors).map(([field, message]) => ({ code: ZodIssueCode.custom, path: [field], message: message as string }))
  );
}

function notActionable(): never {
  throw new AppError(409, "Actions can only be recorded while the Ticket is Open, In Progress, Waiting for Requester, or Reopened", "TICKET_NOT_ACTIONABLE");
}

function stale(currentVersion: number): never {
  throw new AppError(409, "This action was changed by someone else", "STALE_VERSION", { currentVersion });
}

function invalidState(message: string): never {
  throw new AppError(409, message, "INVALID_ACTION_STATE");
}

// BR-08: only an active IT Staff or Administrator can be assigned.
async function assertAssignable(assigneeId: number) {
  const user = await getPrisma().user.findUnique({ where: { id: assigneeId }, select: { isActive: true, role: true } });
  if (!user || !user.isActive || !ASSIGNABLE_ROLES.includes(user.role)) {
    throw new UnprocessableEntityError("Assignee must be an active IT Staff or Administrator");
  }
}

// A Requester reaches only their own Tickets (404 either way, never confirming existence — BR-04);
// IT Staff and Administrators reach any Ticket.
async function findTicket(callerId: number, role: Role, ticketId: number) {
  const prisma = getPrisma();
  const ticket =
    role === "REQUESTER"
      ? await prisma.ticket.findFirst({ where: { id: ticketId, requesterId: callerId }, select: { id: true, status: true } })
      : await prisma.ticket.findUnique({ where: { id: ticketId }, select: { id: true, status: true } });
  if (!ticket) throw new NotFoundError("Ticket not found");
  return ticket;
}

export async function listActions(callerId: number, role: Role, ticketId: number) {
  await findTicket(callerId, role, ticketId);
  // BR-12: always Action Date/Time ascending, then id ascending.
  return getPrisma().actionTaken.findMany({
    where: { ticketId },
    orderBy: [{ actionDateTime: "asc" }, { id: "asc" }],
    select: actionSelect,
  });
}

export async function createAction(callerId: number, role: Role, ticketId: number, input: CreateActionInput) {
  const prisma = getPrisma();
  const ticket = await findTicket(callerId, role, ticketId);

  // BR-21: a repeat of the same clientRequestId returns the original action, not a second one. Checked
  // before the Ticket-state rule so a retry of a request that already succeeded stays harmless.
  const findExisting = () =>
    prisma.actionTaken.findUnique({
      where: { ticketId_clientRequestId: { ticketId, clientRequestId: input.clientRequestId! } },
      select: actionSelect,
    });
  if (input.clientRequestId) {
    const existing = await findExisting();
    if (existing) return { action: existing, created: false };
  }

  if (!ACTIONABLE.includes(ticket.status)) notActionable();

  const status: ActionStatus = input.status ?? "PLANNED";
  const fields = {
    status,
    description: input.description,
    result: input.result ?? null,
    actionDateTime: input.actionDateTime ?? new Date(),
    followUpRequired: input.followUpRequired ?? false,
    followUpNote: input.followUpNote ?? null,
    attachmentNotes: input.attachmentNotes ?? null,
  };
  const errors = validateActionFields(fields);
  if (Object.keys(errors).length > 0) throwFieldErrors(errors);

  const assigneeId = input.assigneeId ?? callerId;
  await assertAssignable(assigneeId);

  try {
    const action = await prisma.$transaction(async (tx) => {
      // BR-14: with the Ticket locked, re-read its status. A request that resolves the Ticket either
      // finished before this point (so this is refused) or waits until this action is committed (so its
      // gate sees it) — a Planned action can never slip in after the gate passed.
      await lockTicket(tx, ticketId);
      const fresh = await tx.ticket.findUniqueOrThrow({ where: { id: ticketId }, select: { status: true } });
      if (!ACTIONABLE.includes(fresh.status)) notActionable();

      return tx.actionTaken.create({
        data: {
          ticketId,
          createdById: callerId, // BR-09: never taken from the request
          assigneeId,
          // BR-09: the completer — here the creator, since the action is created already Completed.
          performedById: status === "COMPLETED" ? callerId : null,
          status,
          actionDateTime: fields.actionDateTime,
          description: fields.description.trim(),
          result: trimmedOrNull(fields.result),
          attachmentNotes: trimmedOrNull(fields.attachmentNotes),
          clientRequestId: input.clientRequestId,
          ...normalizeFollowUp(fields),
        },
        select: actionSelect,
      });
    });
    return { action, created: true };
  } catch (error) {
    // A parallel request with the same clientRequestId won the insert between our check and ours.
    if (input.clientRequestId && error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const existing = await findExisting();
      if (existing) return { action: existing, created: false };
    }
    throw error;
  }
}

export async function updateAction(callerId: number, role: Role, ticketId: number, actionId: number, input: UpdateActionInput) {
  const prisma = getPrisma();
  const ticket = await findTicket(callerId, role, ticketId);
  const current = await prisma.actionTaken.findFirst({ where: { id: actionId, ticketId } });
  if (!current) throw new NotFoundError("Action not found");

  if (!ACTIONABLE.includes(ticket.status)) notActionable();
  if (input.version !== current.version) stale(current.version); // BR-19

  // The values the action would have after this request (omitted fields keep their current value).
  const merged = {
    status: input.status ?? current.status,
    description: input.description ?? current.description,
    result: input.result !== undefined ? input.result : current.result,
    actionDateTime: input.actionDateTime ?? current.actionDateTime,
    followUpRequired: input.followUpRequired ?? current.followUpRequired,
    followUpNote: input.followUpNote !== undefined ? input.followUpNote : current.followUpNote,
    attachmentNotes: input.attachmentNotes !== undefined ? input.attachmentNotes : current.attachmentNotes,
  };
  const next = {
    status: merged.status,
    assigneeId: input.assigneeId ?? current.assigneeId,
    description: merged.description.trim(),
    result: trimmedOrNull(merged.result),
    actionDateTime: merged.actionDateTime,
    attachmentNotes: trimmedOrNull(merged.attachmentNotes),
    ...normalizeFollowUp(merged),
  };

  // Only fields whose value actually differs count as a change, so a client may resend the whole object.
  const changed = (Object.keys(next) as (keyof typeof next)[]).filter((key) => {
    const before = current[key];
    const after = next[key];
    return before instanceof Date && after instanceof Date ? before.getTime() !== after.getTime() : before !== after;
  });

  const editable = editableFieldsFor(current.status);
  const blocked = changed.filter((key) => !editable.includes(key));
  if (blocked.length > 0) {
    invalidState(
      current.status === "CANCELLED"
        ? "A cancelled action is read-only"
        : `A completed action cannot change: ${blocked.join(", ")}`
    );
  }
  if (changed.includes("status") && !canTransition(current.status, next.status)) {
    invalidState(`An action cannot move from ${current.status} to ${next.status}`);
  }

  if (changed.length === 0) return prisma.actionTaken.findUniqueOrThrow({ where: { id: actionId }, select: actionSelect });

  const errors = validateActionFields(next);
  if (Object.keys(errors).length > 0) throwFieldErrors(errors);
  if (changed.includes("assigneeId")) await assertAssignable(next.assigneeId);

  // BR-19: the version in the WHERE makes the compare-and-bump atomic, so of several simultaneous
  // writers holding the same version exactly one succeeds.
  const count = await prisma.$transaction(async (tx) => {
    // Same lock as the resolution gate and action creation (see createAction): completing or cancelling
    // an action cannot interleave with a request that resolves the Ticket.
    await lockTicket(tx, ticketId);
    const fresh = await tx.ticket.findUniqueOrThrow({ where: { id: ticketId }, select: { status: true } });
    if (!ACTIONABLE.includes(fresh.status)) notActionable();

    const { count } = await tx.actionTaken.updateMany({
      where: { id: actionId, version: input.version },
      data: {
        ...next,
        // BR-09: set to the caller on completion, never by the client.
        ...(current.status !== "COMPLETED" && next.status === "COMPLETED" ? { performedById: callerId } : {}),
        version: { increment: 1 },
      },
    });
    return count;
  });
  if (count === 0) {
    const latest = await prisma.actionTaken.findUnique({ where: { id: actionId }, select: { version: true } });
    stale(latest?.version ?? current.version);
  }

  return prisma.actionTaken.findUniqueOrThrow({ where: { id: actionId }, select: actionSelect });
}
