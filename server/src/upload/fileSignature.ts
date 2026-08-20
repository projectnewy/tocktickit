import fs from "node:fs/promises";

// Declared Content-Type is client-supplied and not trusted alone — this reads
// the file's first bytes off disk and checks them against known magic numbers.
const SIGNATURES: Record<string, number[]> = {
  "image/jpeg": [0xff, 0xd8, 0xff],
  "image/png": [0x89, 0x50, 0x4e, 0x47],
  "application/pdf": [0x25, 0x50, 0x44, 0x46], // "%PDF"
};

export async function matchesDeclaredType(filePath: string, mimeType: string): Promise<boolean> {
  const buffer = Buffer.alloc(12);
  const handle = await fs.open(filePath, "r");
  try {
    await handle.read(buffer, 0, 12, 0);
  } finally {
    await handle.close();
  }

  if (mimeType === "image/webp") {
    // RIFF....WEBP: bytes 0-3 "RIFF", bytes 8-11 "WEBP".
    return buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP";
  }

  const signature = SIGNATURES[mimeType];
  if (!signature) return false;
  return signature.every((byte, i) => buffer[i] === byte);
}
