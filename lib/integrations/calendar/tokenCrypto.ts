import crypto from "crypto";

function getKey(): Buffer {
  const hex = process.env.GOOGLE_TOKENS_ENCRYPTION_KEY;
  if (!hex) throw new Error("GOOGLE_TOKENS_ENCRYPTION_KEY is not set");
  return Buffer.from(hex, "hex");
}

export function encryptTokens(tokens: object): string {
  const key = getKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  let enc = cipher.update(JSON.stringify(tokens), "utf8", "hex");
  enc += cipher.final("hex");
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}.${tag.toString("hex")}.${enc}`;
}

export function decryptTokens(stored: string): Record<string, unknown> {
  const key = getKey();
  const [ivHex, tagHex, ciphertext] = stored.split(".");
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(ivHex, "hex")
  );
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  let dec = decipher.update(ciphertext, "hex", "utf8");
  dec += decipher.final("utf8");
  return JSON.parse(dec) as Record<string, unknown>;
}
