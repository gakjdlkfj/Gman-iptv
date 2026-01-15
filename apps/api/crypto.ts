import crypto from "node:crypto";

function mustKey() {
  const hex = process.env.CRED_ENC_KEY_HEX || "";
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error("CRED_ENC_KEY_HEX must be 64 hex chars (32 bytes). See .env.example");
  }
  return Buffer.from(hex, "hex");
}

/** AES-256-GCM envelope to store sensitive fields at rest. */
export function encryptString(plain: string): string {
  const key = mustKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  // iv|tag|ciphertext
  return Buffer.concat([iv, tag, enc]).toString("base64url");
}

export function decryptString(token: string): string {
  const key = mustKey();
  const data = Buffer.from(token, "base64url");
  const iv = data.subarray(0, 12);
  const tag = data.subarray(12, 28);
  const enc = data.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(enc), decipher.final()]);
  return plain.toString("utf8");
}

export function sha256Hex(s: string): string {
  return crypto.createHash("sha256").update(s, "utf8").digest("hex");
}
