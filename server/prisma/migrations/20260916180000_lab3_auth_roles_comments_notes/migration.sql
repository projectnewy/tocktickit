-- CreateEnum
CREATE TYPE "Role" AS ENUM ('REQUESTER', 'IT_STAFF', 'ADMINISTRATOR');

-- AlterEnum: TicketStatus gains OPEN/WAITING_FOR_REQUESTER/REOPENED and drops ASSIGNED.
-- No existing row uses ASSIGNED (Lab 2 only ever produced NEW), so this is a
-- safe rebuild: create the new type, migrate the column via a text cast,
-- drop the old type, rename the new one into place.
CREATE TYPE "TicketStatus_new" AS ENUM ('NEW', 'OPEN', 'IN_PROGRESS', 'WAITING_FOR_REQUESTER', 'RESOLVED', 'CLOSED', 'REOPENED', 'CANCELLED');
ALTER TABLE "Ticket" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Ticket" ALTER COLUMN "status" TYPE "TicketStatus_new" USING ("status"::text::"TicketStatus_new");
ALTER TABLE "Ticket" ALTER COLUMN "status" SET DEFAULT 'NEW';
DROP TYPE "TicketStatus";
ALTER TYPE "TicketStatus_new" RENAME TO "TicketStatus";

-- AlterTable: RequesterUser (Prisma model `User`, see schema.prisma @@map) gains
-- real authentication/role columns. passwordHash backfills existing rows with
-- the bcrypt hash of the documented dev seed password ("Password123!", see
-- src/db/seedData.ts SEED_PASSWORD) so they're immediately usable for login —
-- this is local dev/course seed data only, never a real secret.
ALTER TABLE "RequesterUser" ADD COLUMN     "passwordHash" TEXT NOT NULL DEFAULT '$2b$10$Jr.IkSx.DmJGQ8qNslX61OvUa3LHF9WoNkPdqimveTyyJF/LvUFzq';
ALTER TABLE "RequesterUser" ALTER COLUMN "passwordHash" DROP DEFAULT;
ALTER TABLE "RequesterUser" ADD COLUMN     "role" "Role" NOT NULL DEFAULT 'REQUESTER';
ALTER TABLE "RequesterUser" ADD COLUMN     "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: Ticket gains ownership and the Requester "problem appears resolved" flag.
ALTER TABLE "Ticket" ADD COLUMN     "ownerId" INTEGER;
ALTER TABLE "Ticket" ADD COLUMN     "resolutionIndicated" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Comment" (
    "id" SERIAL NOT NULL,
    "ticketId" INTEGER NOT NULL,
    "authorId" INTEGER NOT NULL,
    "body" VARCHAR(2000) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InternalNote" (
    "id" SERIAL NOT NULL,
    "ticketId" INTEGER NOT NULL,
    "authorId" INTEGER NOT NULL,
    "body" VARCHAR(2000) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InternalNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Ticket_ownerId_status_idx" ON "Ticket"("ownerId", "status");

-- CreateIndex
CREATE INDEX "Ticket_status_createdAt_idx" ON "Ticket"("status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Comment_ticketId_createdAt_idx" ON "Comment"("ticketId", "createdAt");

-- CreateIndex
CREATE INDEX "InternalNote_ticketId_createdAt_idx" ON "InternalNote"("ticketId", "createdAt");

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "RequesterUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "RequesterUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternalNote" ADD CONSTRAINT "InternalNote_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternalNote" ADD CONSTRAINT "InternalNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "RequesterUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
