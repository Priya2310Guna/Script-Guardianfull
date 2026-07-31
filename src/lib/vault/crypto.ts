/**
 * Real browser cryptography for the Script Vault.
 * SHA-256 fingerprints, PBKDF2 password hashing, AES-256-GCM script encryption
 * and RSA-PSS (2048) digital signatures, all via WebCrypto.
 */

const enc = new TextEncoder();
const dec = new TextDecoder();

export function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function toBase64(buf: ArrayBuffer): string {
  let s = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

export function fromBase64(b64: string): Uint8Array<ArrayBuffer> {
  const s = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(s.length));
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

export function randomBytes(n: number): Uint8Array<ArrayBuffer> {
  const a = new Uint8Array(new ArrayBuffer(n));
  crypto.getRandomValues(a);
  return a;
}

/** SHA-256 digital fingerprint of a script (hex). */
export async function sha256Hex(text: string): Promise<string> {
  return toHex(await crypto.subtle.digest("SHA-256", enc.encode(text)));
}

/** PBKDF2-SHA256 password hash (bcrypt-equivalent role, browser-native). */
export async function hashPassword(
  password: string,
  saltB64 = toBase64(randomBytes(16).buffer as ArrayBuffer),
): Promise<{ hash: string; salt: string }> {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: fromBase64(saltB64), iterations: 150_000, hash: "SHA-256" },
    key,
    256,
  );
  return { hash: toBase64(bits), salt: saltB64 };
}

export async function verifyPassword(password: string, hash: string, salt: string) {
  const r = await hashPassword(password, salt);
  return r.hash === hash;
}

/** Derive an AES-256-GCM key from the user's password. */
export async function deriveAesKey(password: string, saltB64: string): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, [
    "deriveKey",
  ]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: fromBase64(saltB64), iterations: 150_000, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export type Encrypted = { iv: string; data: string };

export async function aesEncrypt(key: CryptoKey, plaintext: string): Promise<Encrypted> {
  const iv = randomBytes(12);
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(plaintext));
  return { iv: toBase64(iv.buffer as ArrayBuffer), data: toBase64(ct) };
}

export async function aesDecrypt(key: CryptoKey, payload: Encrypted): Promise<string> {
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64(payload.iv) },
    key,
    fromBase64(payload.data),
  );
  return dec.decode(pt);
}

/* ---------------- RSA digital signatures ---------------- */

const RSA_ALG: RsaHashedKeyGenParams = {
  name: "RSA-PSS",
  modulusLength: 2048,
  publicExponent: new Uint8Array([1, 0, 1]),
  hash: "SHA-256",
};

export async function generateSigningKeypair() {
  const pair = await crypto.subtle.generateKey(RSA_ALG, true, ["sign", "verify"]);
  const publicJwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
  const privateJwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
  return { publicJwk, privateJwk };
}

export async function importPrivateKey(jwk: JsonWebKey) {
  return crypto.subtle.importKey("jwk", jwk, RSA_ALG, false, ["sign"]);
}

export async function importPublicKey(jwk: JsonWebKey) {
  return crypto.subtle.importKey("jwk", jwk, RSA_ALG, false, ["verify"]);
}

/** Sign the SHA-256 fingerprint of a script → base64 RSA signature. */
export async function signHash(privateJwk: JsonWebKey, hashHex: string): Promise<string> {
  const key = await importPrivateKey(privateJwk);
  const sig = await crypto.subtle.sign(
    { name: "RSA-PSS", saltLength: 32 },
    key,
    enc.encode(hashHex),
  );
  return toBase64(sig);
}

export async function verifySignature(
  publicJwk: JsonWebKey,
  hashHex: string,
  signatureB64: string,
): Promise<boolean> {
  try {
    const key = await importPublicKey(publicJwk);
    return await crypto.subtle.verify(
      { name: "RSA-PSS", saltLength: 32 },
      key,
      fromBase64(signatureB64),
      enc.encode(hashHex),
    );
  } catch {
    return false;
  }
}

export function fingerprintShort(hex: string) {
  return `${hex.slice(0, 8)}…${hex.slice(-8)}`;
}
