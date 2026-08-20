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

export async function listActiveRequesters() {
  return getPrisma().requesterUser.findMany({
    where: { isActive: true },
    select: { id: true, fullName: true, email: true, department: true },
    orderBy: { fullName: "asc" },
  });
}
