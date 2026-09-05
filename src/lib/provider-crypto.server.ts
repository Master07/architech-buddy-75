import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/** AES-256-GCM key derived from the project's provisioned secret. */
function key(): Buffer {
  const raw = process.env["AI_PROVIDER_KEY_SECRET"];
  if (!raw) throw new Error("AI_PROVIDER_KEY_SECRET is not set");
  return createHash("sha256").update(raw).digest();
}

export function encryptProviderKey(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ct]).toString("base64");
}

export function decryptProviderKey(stored: string): string {
  const buf = Buffer.from(stored, "base64");
  const decipher = createDecipheriv("aes-256-gcm", key(), buf.subarray(0, 12));
  decipher.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString("utf8");
}

/** Non-secret display hint, e.g. "sk-…8f2c". */
export function keyHint(plaintext: string): string {
  const tail = plaintext.slice(-4);
  const head = plaintext.slice(0, Math.min(3, Math.max(0, plaintext.length - 4)));
  return `${head}…${tail}`;
}
