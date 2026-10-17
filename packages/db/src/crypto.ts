import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Field encryption for what a shop must keep secret at rest (a client's access notes: keys, door codes). AES-256-GCM,
 * a fresh 96-bit IV per value, the row's id as additional authenticated data — a ciphertext copied onto another row
 * does not open. Stored as `v1.<iv>.<tag>.<data>` (base64url), the prefix being the key version for a later rotation.
 * The key is the application's (`APP_DATA_ENCRYPTION_KEY`), never the database's.
 */
const VERSION = "v1";
// @fixed: AES-256 takes a 32-byte key; GCM's recommended nonce is 12 bytes — properties of the cipher, not business settings.
const KEY_BYTES = 32;
// @fixed: see above.
const IV_BYTES = 12;

export class DataKeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DataKeyError";
  }
}

/** The key from its base64 form (32 random bytes); anything else is refused, naming the rule and never the value. */
export function parseDataKey(base64: string | undefined): Buffer {
  const key = Buffer.from(base64 ?? "", "base64");
  if (key.length !== KEY_BYTES) throw new DataKeyError(`the data encryption key must be ${KEY_BYTES} bytes, base64-encoded`);
  return key;
}

export function sealField(plain: string, key: Buffer, aad: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(aad));
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [VERSION, iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), data.toString("base64url")].join(".");
}

export function openField(sealed: string, key: Buffer, aad: string): string {
  const [version, iv, tag, data] = sealed.split(".");
  if (version !== VERSION || !iv || !tag || !data) throw new DataKeyError("unknown sealed format");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
  decipher.setAAD(Buffer.from(aad));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
}
