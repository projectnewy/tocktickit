import type { PrismaClient, Priority, Role } from "@prisma/client";
import { nextTicketNumber } from "../services/ticketNumber.js";
import { hashPassword } from "../auth/password.js";

// ---------------------------------------------------------------------------
// Reference data — idempotent (upsert on the unique natural key). Safe to run
// repeatedly, used by both `npm run prisma:seed` and the test-DB harness.
// ---------------------------------------------------------------------------

const CATEGORY_NAMES = ["Account and Access", "Hardware", "Software", "Network"];

const RELATED_SYSTEMS = [
  { name: "Email", description: "Corporate email and calendaring" },
  { name: "Campus Wi-Fi", description: "Wireless network on campus" },
  { name: "VPN", description: "Remote access VPN" },
  { name: "LEB2 App", description: "Lab submission portal" },
  { name: "Grade Submission App", description: "Instructor grade entry system" },
  { name: "Printer", description: "Shared office/lab printers" },
  { name: "Corporate Laptop", description: "Issued laptop hardware" },
];

// Lab 3: every seeded account shares one dev-only password (documented in
// README, never a real secret). One requester is seeded with
// mustChangePassword=true so the first-login flow (BR-02, AC-02) has a real
// account to demonstrate against out of the box.
export const SEED_PASSWORD = "Password123!";

interface SeedUser {
  fullName: string;
  email: string;
  department?: string;
  isActive: boolean;
  role: Role;
  mustChangePassword?: boolean;
}

const REQUESTERS: SeedUser[] = [
  { fullName: "Jennifer Anderson", email: "jennifer.anderson@example.com", department: "IT", isActive: true, role: "REQUESTER" },
  { fullName: "Michael Brown", email: "michael.brown@example.com", department: "Sales", isActive: true, role: "REQUESTER" },
  { fullName: "Sarah Johnson", email: "sarah.johnson@example.com", department: "Finance", isActive: true, role: "REQUESTER" },
  { fullName: "David Lee", email: "david.lee@example.com", department: "Engineering", isActive: true, role: "REQUESTER", mustChangePassword: true },
  { fullName: "Alex Wong", email: "alex.wong@example.com", department: "Marketing", isActive: false, role: "REQUESTER" },
];

const IT_STAFF: SeedUser[] = [
  { fullName: "Priya Natarajan", email: "priya.natarajan@example.com", department: "IT Support", isActive: true, role: "IT_STAFF" },
  { fullName: "Carlos Mendes", email: "carlos.mendes@example.com", department: "IT Support", isActive: true, role: "IT_STAFF" },
  { fullName: "Emma Wilson", email: "emma.wilson@example.com", department: "IT Support", isActive: true, role: "IT_STAFF" },
  { fullName: "Tom Baker", email: "tom.baker@example.com", department: "IT Support", isActive: false, role: "IT_STAFF" },
];

const ADMINISTRATORS: SeedUser[] = [
  { fullName: "Olivia Grant", email: "olivia.grant@example.com", department: "IT", isActive: true, role: "ADMINISTRATOR" },
];

const ALL_USERS: SeedUser[] = [...REQUESTERS, ...IT_STAFF, ...ADMINISTRATORS];

export async function seedReference(prisma: PrismaClient) {
  for (const name of CATEGORY_NAMES) {
    await prisma.category.upsert({ where: { name }, update: { isActive: true }, create: { name } });
  }
  for (const system of RELATED_SYSTEMS) {
    await prisma.relatedSystem.upsert({
      where: { name: system.name },
      update: { description: system.description, isActive: true },
      create: system,
    });
  }

  const passwordHash = await hashPassword(SEED_PASSWORD);
  for (const seedUser of ALL_USERS) {
    await prisma.user.upsert({
      where: { email: seedUser.email },
      update: {
        fullName: seedUser.fullName,
        department: seedUser.department,
        isActive: seedUser.isActive,
        role: seedUser.role,
      },
      create: {
        fullName: seedUser.fullName,
        email: seedUser.email,
        department: seedUser.department,
        isActive: seedUser.isActive,
        role: seedUser.role,
        passwordHash,
        mustChangePassword: seedUser.mustChangePassword ?? false,
      },
    });
  }

  console.log(
    `Seeded reference data: ${CATEGORY_NAMES.length} categories, ${RELATED_SYSTEMS.length} related systems, ` +
      `${REQUESTERS.length} requesters (${REQUESTERS.filter((r) => r.isActive).length} active), ` +
      `${IT_STAFF.length} IT Staff (${IT_STAFF.filter((s) => s.isActive).length} active), ` +
      `${ADMINISTRATORS.length} Administrator(s). Dev password for all seeded accounts: "${SEED_PASSWORD}".`
  );
}

// ---------------------------------------------------------------------------
// Demo tickets — realistic data for screenshots/E2E against the DEV database
// only. Never used by the test-DB harness. Guarded so it doesn't pile up
// duplicate tickets if run more than once.
// ---------------------------------------------------------------------------

const DEMO_TICKETS: Array<{
  requesterEmail: string;
  categoryName: string;
  relatedSystemName: string;
  summary: string;
  description: string;
  requestedPriority: Priority;
}> = [
  { requesterEmail: "jennifer.anderson@example.com", categoryName: "Hardware", relatedSystemName: "Corporate Laptop", summary: "Laptop battery drains quickly", description: "The battery drains much faster than usual even when the system is idle. This started happening after last week's Windows update.", requestedPriority: "MEDIUM" },
  { requesterEmail: "jennifer.anderson@example.com", categoryName: "Network", relatedSystemName: "VPN", summary: "Cannot connect to VPN", description: "VPN client fails to connect from home network with a timeout error.", requestedPriority: "HIGH" },
  { requesterEmail: "jennifer.anderson@example.com", categoryName: "Software", relatedSystemName: "Email", summary: "Email not syncing on mobile", description: "New emails are not appearing on the mobile app, only on desktop.", requestedPriority: "MEDIUM" },
  { requesterEmail: "jennifer.anderson@example.com", categoryName: "Account and Access", relatedSystemName: "LEB2 App", summary: "New employee setup request", description: "Need LEB2 App access provisioned for a new starter joining next week.", requestedPriority: "LOW" },
  { requesterEmail: "jennifer.anderson@example.com", categoryName: "Hardware", relatedSystemName: "Printer", summary: "Printer keeps showing offline", description: "3rd floor printer shows offline intermittently despite being powered on.", requestedPriority: "MEDIUM" },
  { requesterEmail: "jennifer.anderson@example.com", categoryName: "Account and Access", relatedSystemName: "LEB2 App", summary: "Request access to SharePoint", description: "Need read access to the shared project folder for the new intake.", requestedPriority: "LOW" },
  { requesterEmail: "jennifer.anderson@example.com", categoryName: "Software", relatedSystemName: "Grade Submission App", summary: "Outlook freezing intermittently", description: "Outlook freezes for 10-20 seconds when opening large attachments.", requestedPriority: "HIGH" },
  { requesterEmail: "jennifer.anderson@example.com", categoryName: "Hardware", relatedSystemName: "Corporate Laptop", summary: "Docking station not detected", description: "External monitors don't turn on when the laptop is docked.", requestedPriority: "MEDIUM" },
  { requesterEmail: "jennifer.anderson@example.com", categoryName: "Network", relatedSystemName: "Campus Wi-Fi", summary: "Wi-Fi drops in the east wing", description: "Connection drops every few minutes when working from the east wing meeting rooms.", requestedPriority: "MEDIUM" },
  { requesterEmail: "jennifer.anderson@example.com", categoryName: "Software", relatedSystemName: "Grade Submission App", summary: "Cannot submit final grades", description: "Submission button is greyed out on the final review page.", requestedPriority: "URGENT" },
  { requesterEmail: "jennifer.anderson@example.com", categoryName: "Account and Access", relatedSystemName: "Email", summary: "Password reset needed", description: "Locked out of email after too many failed login attempts.", requestedPriority: "HIGH" },
  { requesterEmail: "jennifer.anderson@example.com", categoryName: "Hardware", relatedSystemName: "Printer", summary: "Toner replacement request", description: "2nd floor printer toner is low and needs replacing.", requestedPriority: "LOW" },
  { requesterEmail: "jennifer.anderson@example.com", categoryName: "Network", relatedSystemName: "VPN", summary: "VPN speed extremely slow", description: "File transfers over VPN are taking 10x longer than usual.", requestedPriority: "MEDIUM" },
  { requesterEmail: "jennifer.anderson@example.com", categoryName: "Software", relatedSystemName: "LEB2 App", summary: "Upload fails on LEB2 App", description: "File upload fails silently for files over 2MB on the lab submission portal.", requestedPriority: "HIGH" },
  { requesterEmail: "michael.brown@example.com", categoryName: "Hardware", relatedSystemName: "Corporate Laptop", summary: "Keyboard keys unresponsive", description: "The 'A' and 'S' keys intermittently stop responding.", requestedPriority: "MEDIUM" },
  { requesterEmail: "michael.brown@example.com", categoryName: "Account and Access", relatedSystemName: "Email", summary: "Distribution list access needed", description: "Need to be added to the sales-team distribution list.", requestedPriority: "LOW" },
];

export async function seedDemoTickets(prisma: PrismaClient) {
  const existing = await prisma.ticket.count();
  if (existing > 0) {
    console.log(`Skipped demo tickets: ${existing} ticket(s) already exist.`);
    return;
  }

  const requesters = await prisma.user.findMany({ where: { role: "REQUESTER" } });
  const categories = await prisma.category.findMany();
  const relatedSystems = await prisma.relatedSystem.findMany();

  const requesterByEmail = new Map(requesters.map((r) => [r.email, r]));
  const categoryByName = new Map(categories.map((c) => [c.name, c]));
  const systemByName = new Map(relatedSystems.map((s) => [s.name, s]));

  let created = 0;
  for (const demo of DEMO_TICKETS) {
    const requester = requesterByEmail.get(demo.requesterEmail);
    const category = categoryByName.get(demo.categoryName);
    const relatedSystem = systemByName.get(demo.relatedSystemName);
    if (!requester || !category || !relatedSystem) continue;

    await prisma.$transaction(async (tx) => {
      const ticketNumber = await nextTicketNumber(tx);
      await tx.ticket.create({
        data: {
          ticketNumber,
          summary: demo.summary,
          description: demo.description,
          requestedPriority: demo.requestedPriority,
          requesterId: requester.id,
          categoryId: category.id,
          relatedSystemId: relatedSystem.id,
        },
      });
    });
    created++;
  }
  console.log(`Seeded ${created} demo tickets.`);
}
