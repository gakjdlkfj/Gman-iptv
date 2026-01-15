import crypto from "node:crypto";

export function id(prefix: string) {
  return `${prefix}_${crypto.randomBytes(12).toString("hex")}`;
}
