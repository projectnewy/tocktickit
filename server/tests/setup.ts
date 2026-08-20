import { afterAll } from "vitest";
import { getPrisma } from "../src/prisma.js";

// Closes the shared Prisma connection once after the whole run so vitest
// doesn't hang on an open database handle.
afterAll(async () => {
  await getPrisma().$disconnect();
});
