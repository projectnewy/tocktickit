import type { PrismaClient, Priority, Role, TicketStatus } from "@prisma/client";
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

// ---------------------------------------------------------------------------
// Lab 4 demo workflow data (specification.md §7, FR-15): Tickets in every status and priority, owned
// and unassigned, with zero, one, and many Actions Taken, so both zero and non-zero dashboard metrics
// exist. Idempotent: a Ticket is identified by (requester, summary) and is only created — together with
// its actions — when it is missing, so running the seed again adds nothing. Sarah Johnson deliberately
// has no Tickets (all-zero Requester dashboard); Michael Brown has waiting and resolved ones.
// ---------------------------------------------------------------------------

interface DemoAction {
  by: string; // creator's email
  assignee: string; // assignee's email
  status: "PLANNED" | "COMPLETED" | "CANCELLED";
  daysAgo: number;
  description: string;
  result?: string;
  followUpNote?: string;
  attachmentNotes?: string;
}

interface DemoWorkTicket {
  requesterEmail: string;
  categoryName: string;
  relatedSystemName: string;
  summary: string;
  description: string;
  requestedPriority: Priority;
  itPriority: Priority;
  status: TicketStatus;
  ownerEmail?: string;
  updatedDaysAgo: number;
  resolvedDaysAgo?: number;
  resolutionIndicated?: boolean;
  actions: DemoAction[];
}

const PRIYA = "priya.natarajan@example.com";
const CARLOS = "carlos.mendes@example.com";
const EMMA = "emma.wilson@example.com";
const OLIVIA = "olivia.grant@example.com";
const MICHAEL = "michael.brown@example.com";
const JENNIFER = "jennifer.anderson@example.com";

const DEMO_WORK_TICKETS: DemoWorkTicket[] = [
  {
    requesterEmail: MICHAEL, categoryName: "Network", relatedSystemName: "Campus Wi-Fi",
    summary: "Wi-Fi certificate expired on laptop", description: "The laptop refuses to join the campus Wi-Fi and reports an expired certificate.",
    requestedPriority: "HIGH", itPriority: "URGENT", status: "IN_PROGRESS", ownerEmail: CARLOS, updatedDaysAgo: 0,
    actions: [
      { by: CARLOS, assignee: CARLOS, status: "COMPLETED", daysAgo: 2, description: "Reproduced the certificate error on a test laptop", result: "Confirmed the root certificate expired on 1 Oct" },
      { by: CARLOS, assignee: PRIYA, status: "PLANNED", daysAgo: -1, description: "Push the renewed certificate through device management" },
      { by: PRIYA, assignee: EMMA, status: "PLANNED", daysAgo: -2, description: "Verify the laptop joins Wi-Fi after the push" },
      { by: CARLOS, assignee: CARLOS, status: "CANCELLED", daysAgo: 1, description: "Reimage the laptop (not needed)" },
    ],
  },
  {
    requesterEmail: MICHAEL, categoryName: "Hardware", relatedSystemName: "Corporate Laptop",
    summary: "Request for a second monitor", description: "Working with two documents side by side would be much easier with a second monitor.",
    requestedPriority: "LOW", itPriority: "LOW", status: "WAITING_FOR_REQUESTER", ownerEmail: PRIYA, updatedDaysAgo: 1,
    actions: [
      { by: PRIYA, assignee: PRIYA, status: "COMPLETED", daysAgo: 1, description: "Checked stock for a matching monitor", result: "Monitor reserved, waiting for the desk number", followUpNote: "Ask the requester for the desk number", attachmentNotes: "Desk plan PDF is on the Ticket" },
    ],
  },
  {
    requesterEmail: MICHAEL, categoryName: "Hardware", relatedSystemName: "Printer",
    summary: "Printer driver install failed", description: "The driver installer stops at 80% and rolls back.",
    requestedPriority: "MEDIUM", itPriority: "MEDIUM", status: "RESOLVED", ownerEmail: EMMA, updatedDaysAgo: 2, resolvedDaysAgo: 2,
    actions: [
      { by: EMMA, assignee: EMMA, status: "COMPLETED", daysAgo: 3, description: "Cleared the stuck installer cache", result: "Installer runs to completion" },
      { by: EMMA, assignee: EMMA, status: "COMPLETED", daysAgo: 2, description: "Installed the current driver and printed a test page", result: "Test page printed" },
    ],
  },
  {
    requesterEmail: MICHAEL, categoryName: "Account and Access", relatedSystemName: "LEB2 App",
    summary: "Badge reader rejects my card", description: "The reader at the lab door shows a red light for my card.",
    requestedPriority: "HIGH", itPriority: "HIGH", status: "CLOSED", ownerEmail: CARLOS, updatedDaysAgo: 10, resolvedDaysAgo: 12,
    actions: [
      { by: CARLOS, assignee: CARLOS, status: "COMPLETED", daysAgo: 12, description: "Re-enrolled the card at the access panel", result: "Card accepted by the reader" },
    ],
  },
  {
    requesterEmail: MICHAEL, categoryName: "Software", relatedSystemName: "Email",
    summary: "Shared drive not mapping after reboot", description: "The team share disappears after every reboot and has to be mapped again.",
    requestedPriority: "MEDIUM", itPriority: "HIGH", status: "OPEN", ownerEmail: PRIYA, updatedDaysAgo: 3,
    actions: [
      { by: PRIYA, assignee: CARLOS, status: "PLANNED", daysAgo: -1, description: "Check the logon script that maps the share" },
    ],
  },
  {
    requesterEmail: JENNIFER, categoryName: "Hardware", relatedSystemName: "Corporate Laptop",
    summary: "Conference room display flickers", description: "The display in room 4B flickers a few minutes into every meeting.",
    requestedPriority: "MEDIUM", itPriority: "MEDIUM", status: "REOPENED", ownerEmail: PRIYA, updatedDaysAgo: 1,
    actions: [
      { by: PRIYA, assignee: PRIYA, status: "COMPLETED", daysAgo: 8, description: "Replaced the HDMI cable", result: "Flicker stopped during a 30 minute test" },
    ],
  },
  {
    requesterEmail: JENNIFER, categoryName: "Account and Access", relatedSystemName: "Email",
    summary: "Duplicate charge on software license", description: "The renewal for a design tool was charged twice this month.",
    requestedPriority: "LOW", itPriority: "LOW", status: "CANCELLED", updatedDaysAgo: 5,
    actions: [],
  },
  {
    requesterEmail: JENNIFER, categoryName: "Account and Access", relatedSystemName: "VPN",
    summary: "VPN token is not arriving", description: "The authenticator code never reaches my phone when I sign in to the VPN.",
    requestedPriority: "URGENT", itPriority: "URGENT", status: "NEW", updatedDaysAgo: 0,
    actions: [],
  },
  {
    requesterEmail: JENNIFER, categoryName: "Hardware", relatedSystemName: "Corporate Laptop",
    summary: "Laptop fan is very loud", description: "The fan runs at full speed even when the laptop is idle.",
    requestedPriority: "MEDIUM", itPriority: "MEDIUM", status: "OPEN", ownerEmail: OLIVIA, updatedDaysAgo: 4,
    actions: [],
  },
  {
    requesterEmail: JENNIFER, categoryName: "Software", relatedSystemName: "LEB2 App",
    summary: "Slow login on the shared lab PC", description: "Signing in on the shared lab PC takes more than two minutes.",
    requestedPriority: "HIGH", itPriority: "URGENT", status: "IN_PROGRESS", ownerEmail: PRIYA, updatedDaysAgo: 0, resolutionIndicated: true,
    actions: [
      { by: PRIYA, assignee: PRIYA, status: "COMPLETED", daysAgo: 1, description: "Cleaned up stale roaming profiles", result: "Login time dropped to 40 seconds" },
      { by: PRIYA, assignee: EMMA, status: "COMPLETED", daysAgo: 0, description: "Re-tested login on three lab PCs", result: "All three under 30 seconds" },
    ],
  },
];

const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000);

export async function seedDemoWorkflow(prisma: PrismaClient) {
  const users = await prisma.user.findMany();
  const userByEmail = new Map(users.map((u) => [u.email, u]));
  const category = new Map((await prisma.category.findMany()).map((c) => [c.name, c]));
  const system = new Map((await prisma.relatedSystem.findMany()).map((s) => [s.name, s]));

  let createdTickets = 0;
  let createdActions = 0;
  for (const demo of DEMO_WORK_TICKETS) {
    const requester = userByEmail.get(demo.requesterEmail);
    const cat = category.get(demo.categoryName);
    const sys = system.get(demo.relatedSystemName);
    if (!requester || !cat || !sys) continue;

    const exists = await prisma.ticket.findFirst({ where: { requesterId: requester.id, summary: demo.summary }, select: { id: true } });
    if (exists) continue;

    await prisma.$transaction(async (tx) => {
      const ticket = await tx.ticket.create({
        data: {
          ticketNumber: await nextTicketNumber(tx),
          summary: demo.summary,
          description: demo.description,
          requestedPriority: demo.requestedPriority,
          itPriority: demo.itPriority,
          status: demo.status,
          resolutionIndicated: demo.resolutionIndicated ?? false,
          resolvedAt: demo.resolvedDaysAgo !== undefined ? daysAgo(demo.resolvedDaysAgo) : null,
          updatedAt: daysAgo(demo.updatedDaysAgo),
          requesterId: requester.id,
          ownerId: demo.ownerEmail ? userByEmail.get(demo.ownerEmail)?.id : null,
          categoryId: cat.id,
          relatedSystemId: sys.id,
        },
      });
      for (const action of demo.actions) {
        const creator = userByEmail.get(action.by);
        const assignee = userByEmail.get(action.assignee);
        if (!creator || !assignee) continue;
        await tx.actionTaken.create({
          data: {
            ticketId: ticket.id,
            createdById: creator.id,
            assigneeId: assignee.id,
            performedById: action.status === "COMPLETED" ? assignee.id : null,
            status: action.status,
            actionDateTime: daysAgo(action.daysAgo),
            description: action.description,
            result: action.result ?? null,
            followUpRequired: action.followUpNote !== undefined,
            followUpNote: action.followUpNote ?? null,
            attachmentNotes: action.attachmentNotes ?? null,
          },
        });
        createdActions++;
      }
    });
    createdTickets++;
  }
  console.log(`Seeded ${createdTickets} workflow demo ticket(s) with ${createdActions} action(s) (existing ones left untouched).`);
}

export async function seedDemoTickets(prisma: PrismaClient) {
  await seedDemoBaseTickets(prisma);
  await seedDemoWorkflow(prisma);
}

async function seedDemoBaseTickets(prisma: PrismaClient) {
  const existing = await prisma.ticket.count();
  if (existing > 0) {
    console.log(`Skipped base demo tickets: ${existing} ticket(s) already exist.`);
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
          itPriority: demo.requestedPriority, // BR-34: IT Priority starts as the requested one
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
