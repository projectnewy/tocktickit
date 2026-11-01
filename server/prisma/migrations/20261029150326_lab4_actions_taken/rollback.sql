-- Lab 4 rollback / recovery (specification.md §7). NOT applied by `prisma migrate`; run it manually
-- (or from tests/lab-04/migration.test.ts) to undo 20261029150326_lab4_actions_taken.
-- The migration is purely additive, so no earlier row is lost: only Actions Taken and the new
-- Ticket columns are removed. The itPriority backfill is deliberately NOT reverted (it only filled
-- values that were null, and reverting it would also null values staff set deliberately).
-- After running this, delete the row for this migration from "_prisma_migrations" (or run
-- `prisma migrate resolve --rolled-back 20261029150326_lab4_actions_taken`) so it can re-apply.
DROP INDEX IF EXISTS "Ticket_requesterId_updatedAt_idx";
DROP INDEX IF EXISTS "Ticket_status_updatedAt_idx";
DROP TABLE IF EXISTS "ActionTaken";
DROP TYPE IF EXISTS "ActionStatus";
ALTER TABLE "Ticket" DROP COLUMN IF EXISTS "resolvedAt", DROP COLUMN IF EXISTS "version";
