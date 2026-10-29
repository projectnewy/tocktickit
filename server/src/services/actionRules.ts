// Pure rules for Actions Taken (docs/lab-04/specification.md §5.1). No database, no HTTP:
// the API layer calls these so the rules are defined once and unit-tested in isolation.

export const ACTION_STATUSES = ["PLANNED", "COMPLETED", "CANCELLED"] as const;
export type ActionStatusValue = (typeof ACTION_STATUSES)[number];

// BR-06: Completed and Cancelled are terminal for status.
const TRANSITIONS: Record<ActionStatusValue, readonly ActionStatusValue[]> = {
  PLANNED: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

export function canTransition(from: ActionStatusValue, to: ActionStatusValue): boolean {
  return TRANSITIONS[from].includes(to);
}

// BR-10: the content a Completed action may still correct. Status and assignee are not in it.
const CONTENT_FIELDS = ["description", "result", "actionDateTime", "followUpRequired", "followUpNote", "attachmentNotes"] as const;

const EDITABLE_FIELDS: Record<ActionStatusValue, readonly string[]> = {
  PLANNED: [...CONTENT_FIELDS, "assigneeId", "status"],
  COMPLETED: CONTENT_FIELDS,
  CANCELLED: [],
};

export function editableFieldsFor(status: ActionStatusValue): readonly string[] {
  return EDITABLE_FIELDS[status];
}

export const LIMITS = {
  description: 2000,
  result: 2000,
  followUpNote: 1000,
  attachmentNotes: 500,
} as const;

// A Completed action's date/time may not be in the future beyond this clock tolerance (BR-07).
export const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;

export interface ActionFieldsInput {
  status: ActionStatusValue;
  description: string;
  result: string | null;
  actionDateTime: Date;
  followUpRequired: boolean;
  followUpNote: string | null;
  attachmentNotes: string | null;
}

export type ActionFieldErrors = Partial<Record<"description" | "result" | "actionDateTime" | "followUpNote" | "attachmentNotes", string>>;

// Whitespace-only text counts as empty, so a required field cannot be satisfied with spaces.
const trimmed = (value: string | null | undefined) => (value ?? "").trim();

export function validateActionFields(fields: ActionFieldsInput, now: Date = new Date()): ActionFieldErrors {
  const errors: ActionFieldErrors = {};

  const description = trimmed(fields.description);
  if (description.length === 0) errors.description = "Description is required.";
  else if (description.length > LIMITS.description) errors.description = `Description must be at most ${LIMITS.description} characters.`;

  const result = trimmed(fields.result);
  if (fields.status === "COMPLETED" && result.length === 0) errors.result = "Result is required to complete an action.";
  else if (result.length > LIMITS.result) errors.result = `Result must be at most ${LIMITS.result} characters.`;

  if (fields.followUpRequired) {
    const note = trimmed(fields.followUpNote);
    if (note.length === 0) errors.followUpNote = "Follow-up note is required when follow-up is required.";
    else if (note.length > LIMITS.followUpNote) errors.followUpNote = `Follow-up note must be at most ${LIMITS.followUpNote} characters.`;
  }

  if (trimmed(fields.attachmentNotes).length > LIMITS.attachmentNotes) {
    errors.attachmentNotes = `Attachment notes must be at most ${LIMITS.attachmentNotes} characters.`;
  }

  const time = fields.actionDateTime.getTime();
  if (Number.isNaN(time)) errors.actionDateTime = "Action date/time is not a valid date.";
  else if (fields.status === "COMPLETED" && time > now.getTime() + FUTURE_TOLERANCE_MS) {
    errors.actionDateTime = "A completed action cannot be dated in the future.";
  }

  return errors;
}

// BR-07: the note is kept only while follow-up is required; otherwise it is discarded.
export function normalizeFollowUp(fields: { followUpRequired: boolean; followUpNote: string | null }) {
  return {
    followUpRequired: fields.followUpRequired,
    followUpNote: fields.followUpRequired ? trimmed(fields.followUpNote) || null : null,
  };
}
