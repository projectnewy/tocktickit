-- CreateEnum
CREATE TYPE "ActionStatus" AS ENUM ('PLANNED', 'COMPLETED', 'CANCELLED');

-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "resolvedAt" TIMESTAMP(3),
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "ActionTaken" (
    "id" SERIAL NOT NULL,
    "ticketId" INTEGER NOT NULL,
    "createdById" INTEGER NOT NULL,
    "assigneeId" INTEGER NOT NULL,
    "performedById" INTEGER,
    "status" "ActionStatus" NOT NULL DEFAULT 'PLANNED',
    "actionDateTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "description" VARCHAR(2000) NOT NULL,
    "result" VARCHAR(2000),
    "followUpRequired" BOOLEAN NOT NULL DEFAULT false,
    "followUpNote" VARCHAR(1000),
    "attachmentNotes" VARCHAR(500),
    "clientRequestId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActionTaken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ActionTaken_ticketId_actionDateTime_id_idx" ON "ActionTaken"("ticketId", "actionDateTime", "id");

-- CreateIndex
CREATE INDEX "ActionTaken_assigneeId_status_actionDateTime_idx" ON "ActionTaken"("assigneeId", "status", "actionDateTime");

-- CreateIndex
CREATE UNIQUE INDEX "ActionTaken_ticketId_clientRequestId_key" ON "ActionTaken"("ticketId", "clientRequestId");

-- CreateIndex
CREATE INDEX "Ticket_status_updatedAt_idx" ON "Ticket"("status", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "Ticket_requesterId_updatedAt_idx" ON "Ticket"("requesterId", "updatedAt" DESC);

-- AddForeignKey
ALTER TABLE "ActionTaken" ADD CONSTRAINT "ActionTaken_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionTaken" ADD CONSTRAINT "ActionTaken_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "RequesterUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionTaken" ADD CONSTRAINT "ActionTaken_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "RequesterUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionTaken" ADD CONSTRAINT "ActionTaken_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "RequesterUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill (additive: only fills the new column and previously-null values; nothing is dropped
-- or rewritten). Tickets already Resolved/Closed get their best available resolution time
-- (specification.md decision 4); null IT Priority takes the Requested Priority (BR-34).
UPDATE "Ticket" SET "resolvedAt" = "updatedAt" WHERE "status" IN ('RESOLVED', 'CLOSED') AND "resolvedAt" IS NULL;
UPDATE "Ticket" SET "itPriority" = "requestedPriority" WHERE "itPriority" IS NULL;
