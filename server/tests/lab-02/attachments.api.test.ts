import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { resetDb } from "../helpers/db.js";
import { makeRequester, makeTicket, makeAttachment } from "../helpers/factories.js";

// Minimal valid file bytes for each allowed type, enough for the magic-byte sniff to pass.
const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const JPEG_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
const PDF_BYTES = Buffer.from("%PDF-1.4\nmore content here to pad it out a bit");
const TEXT_BYTES = Buffer.from("just plain text, not a real image");

describe("POST /api/tickets/:ticketId/attachments", () => {
  beforeEach(resetDb);

  it("accepts a valid PNG/JPEG/PDF upload (API-15)", async () => {
    const ticket = await makeTicket({ requesterId: 1 });

    const png = await request(app)
      .post(`/api/tickets/${ticket.id}/attachments`)
      .set("X-Requester-Id", "1")
      .attach("file", PNG_BYTES, { filename: "photo.png", contentType: "image/png" });
    expect(png.status).toBe(201);
    expect(png.body.originalFilename).toBe("photo.png");
    expect(png.body.isRemoved).toBe(false);

    const pdf = await request(app)
      .post(`/api/tickets/${ticket.id}/attachments`)
      .set("X-Requester-Id", "1")
      .attach("file", PDF_BYTES, { filename: "report.pdf", contentType: "application/pdf" });
    expect(pdf.status).toBe(201);
  });

  it("rejects a disallowed file type with 415 (API-15, AC-10)", async () => {
    const ticket = await makeTicket({ requesterId: 1 });
    const res = await request(app)
      .post(`/api/tickets/${ticket.id}/attachments`)
      .set("X-Requester-Id", "1")
      .attach("file", TEXT_BYTES, { filename: "notes.txt", contentType: "text/plain" });
    expect(res.status).toBe(415);
  });

  it("rejects a file over 5 MB with 413 (API-15, AC-11)", async () => {
    const ticket = await makeTicket({ requesterId: 1 });
    const oversized = Buffer.concat([JPEG_BYTES, Buffer.alloc(5 * 1024 * 1024)]);
    const res = await request(app)
      .post(`/api/tickets/${ticket.id}/attachments`)
      .set("X-Requester-Id", "1")
      .attach("file", oversized, { filename: "huge.jpg", contentType: "image/jpeg" });
    expect(res.status).toBe(413);
  });

  it("rejects a file whose content doesn't match its declared type, even with an allowed extension (API-16)", async () => {
    const ticket = await makeTicket({ requesterId: 1 });
    const res = await request(app)
      .post(`/api/tickets/${ticket.id}/attachments`)
      .set("X-Requester-Id", "1")
      .attach("file", TEXT_BYTES, { filename: "fake.png", contentType: "image/png" });
    expect(res.status).toBe(415);
  });

  it("rejects a 6th active attachment on a ticket that already has 5 (API-17, AC-06)", async () => {
    const ticket = await makeTicket({ requesterId: 1 });
    for (let i = 0; i < 5; i++) {
      await makeAttachment({ ticketId: ticket.id, uploadedById: 1 });
    }
    const res = await request(app)
      .post(`/api/tickets/${ticket.id}/attachments`)
      .set("X-Requester-Id", "1")
      .attach("file", PNG_BYTES, { filename: "one-too-many.png", contentType: "image/png" });
    expect(res.status).toBe(409);
  });

  it("frees a slot on removal, allowing a new upload on an otherwise-full ticket (API-18)", async () => {
    const ticket = await makeTicket({ requesterId: 1 });
    const toRemove = await makeAttachment({ ticketId: ticket.id, uploadedById: 1 });
    for (let i = 0; i < 4; i++) {
      await makeAttachment({ ticketId: ticket.id, uploadedById: 1 });
    }

    await request(app)
      .delete(`/api/attachments/${toRemove.id}`)
      .set("X-Requester-Id", "1")
      .send({ reason: "Wrong file" });

    const res = await request(app)
      .post(`/api/tickets/${ticket.id}/attachments`)
      .set("X-Requester-Id", "1")
      .attach("file", PNG_BYTES, { filename: "replacement.png", contentType: "image/png" });
    expect(res.status).toBe(201);
  });
});

describe("DELETE /api/attachments/:attachmentId", () => {
  beforeEach(resetDb);

  it("soft-removes an attachment with a reason (API-19, AC-07, AC-17)", async () => {
    const ticket = await makeTicket({ requesterId: 1 });
    const attachment = await makeAttachment({ ticketId: ticket.id, uploadedById: 1 });

    const res = await request(app)
      .delete(`/api/attachments/${attachment.id}`)
      .set("X-Requester-Id", "1")
      .send({ reason: "Uploaded by mistake" });

    expect(res.status).toBe(200);
    expect(res.body.isRemoved).toBe(true);
    expect(res.body.removedReason).toBe("Uploaded by mistake");
    expect(res.body.removedBy).toEqual({ id: 1, fullName: "Jennifer Anderson" });
  });

  it("rejects removal without a reason (API-19, AC-17)", async () => {
    const ticket = await makeTicket({ requesterId: 1 });
    const attachment = await makeAttachment({ ticketId: ticket.id, uploadedById: 1 });

    const res = await request(app)
      .delete(`/api/attachments/${attachment.id}`)
      .set("X-Requester-Id", "1")
      .send({});
    expect(res.status).toBe(400);
  });

  it("rejects removing an already-removed attachment", async () => {
    const ticket = await makeTicket({ requesterId: 1 });
    const attachment = await makeAttachment({ ticketId: ticket.id, uploadedById: 1 });
    await request(app).delete(`/api/attachments/${attachment.id}`).set("X-Requester-Id", "1").send({ reason: "First removal" });

    const res = await request(app)
      .delete(`/api/attachments/${attachment.id}`)
      .set("X-Requester-Id", "1")
      .send({ reason: "Second removal" });
    expect(res.status).toBe(409);
  });
});

describe("GET /api/attachments/:attachmentId/download", () => {
  beforeEach(resetDb);

  it("serves an active attachment's bytes (API-20)", async () => {
    const ticket = await makeTicket({ requesterId: 1 });
    const upload = await request(app)
      .post(`/api/tickets/${ticket.id}/attachments`)
      .set("X-Requester-Id", "1")
      .attach("file", PNG_BYTES, { filename: "photo.png", contentType: "image/png" });

    const res = await request(app)
      .get(`/api/attachments/${upload.body.id}/download`)
      .set("X-Requester-Id", "1");

    expect(res.status).toBe(200);
    expect(res.headers["content-disposition"]).toContain("photo.png");
  });

  it("returns 410 for a removed attachment; bytes are never served (API-20, AC-07)", async () => {
    const ticket = await makeTicket({ requesterId: 1 });
    const attachment = await makeAttachment({ ticketId: ticket.id, uploadedById: 1 });
    await request(app).delete(`/api/attachments/${attachment.id}`).set("X-Requester-Id", "1").send({ reason: "Wrong file" });

    const res = await request(app)
      .get(`/api/attachments/${attachment.id}/download`)
      .set("X-Requester-Id", "1");
    expect(res.status).toBe(410);
  });
});

describe("cross-requester attachment access (API-21, FR-12)", () => {
  beforeEach(resetDb);

  it("rejects every operation on another requester's attachment with 404 and no data leaked", async () => {
    const owner = await makeRequester();
    const ticket = await makeTicket({ requesterId: owner.id });
    const attachment = await makeAttachment({ ticketId: ticket.id, uploadedById: owner.id });

    const get = await request(app).get(`/api/attachments/${attachment.id}`).set("X-Requester-Id", "1");
    expect(get.status).toBe(404);
    expect(get.body).not.toHaveProperty("originalFilename");

    const download = await request(app).get(`/api/attachments/${attachment.id}/download`).set("X-Requester-Id", "1");
    expect(download.status).toBe(404);

    const list = await request(app).get(`/api/tickets/${ticket.id}/attachments`).set("X-Requester-Id", "1");
    expect(list.status).toBe(404);

    const remove = await request(app)
      .delete(`/api/attachments/${attachment.id}`)
      .set("X-Requester-Id", "1")
      .send({ reason: "Trying to remove someone else's file" });
    expect(remove.status).toBe(404);

    const upload = await request(app)
      .post(`/api/tickets/${ticket.id}/attachments`)
      .set("X-Requester-Id", "1")
      .attach("file", PNG_BYTES, { filename: "intrusion.png", contentType: "image/png" });
    expect(upload.status).toBe(404);
  });
});
