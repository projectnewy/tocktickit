import { getPrisma } from "../../src/prisma.js";
import { seedReference } from "../../src/db/seedData.js";

// Truncates every application table and reseeds reference data. Call from
// `beforeEach` in every API test file so no test depends on state left by a
// previous test or a previous run. Never run against the dev database.
export async function resetDb() {
  const prisma = getPrisma();
  await prisma.$executeRawUnsafe(
    `TRUNCATE "Attachment", "Ticket", "TicketCounter", "RequesterUser", "RelatedSystem", "Category" RESTART IDENTITY CASCADE;`
  );
  await seedReference(prisma);
}
