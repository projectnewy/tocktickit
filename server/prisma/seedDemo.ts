import { getPrisma } from "../src/prisma.js";
import { seedReference, seedDemoTickets } from "../src/db/seedData.js";

// Populates realistic demo tickets for screenshots/E2E, on top of reference
// data. Only ever run against the dev database — never the test database.
async function main() {
  const prisma = getPrisma();
  await seedReference(prisma);
  await seedDemoTickets(prisma);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await getPrisma().$disconnect();
  });
