import { getPrisma } from "../src/prisma.js";
import { seedReference } from "../src/db/seedData.js";

// Thin CLI wrapper — the actual seed data and logic live in src/db/seedData.ts
// so they're typechecked by `npm run build` and importable from tests.
seedReference(getPrisma())
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await getPrisma().$disconnect();
  });
