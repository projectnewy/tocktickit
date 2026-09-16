import { getPrisma } from "../prisma.js";

export async function listActiveCategories() {
  return getPrisma().category.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { id: "asc" },
  });
}

export async function listActiveRelatedSystems() {
  return getPrisma().relatedSystem.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

// Retained for now (Lab 2's /api/requesters, backing the Development
// Requester selector). The selector itself is removed in the Requester
// regression Issue; this endpoint is left in place until then rather than
// deleted here, to avoid an unrelated breaking change mid-Issue-32.
export async function listActiveRequesters() {
  return getPrisma().user.findMany({
    where: { isActive: true, role: "REQUESTER" },
    select: { id: true, fullName: true, email: true, department: true },
    orderBy: { fullName: "asc" },
  });
}
