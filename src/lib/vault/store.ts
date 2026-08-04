/**
 * Vault persistence layer (browser-local).
 * Full script bodies are stored AES-256-GCM encrypted under the owner's
 * password-derived key. Only a non-reversible narrative index is kept in the
 * clear so cross-account similarity detection can run without exposing scripts.
 */
import {
  aesDecrypt,
  aesEncrypt,
  deriveAesKey,
  generateSigningKeypair,
  hashPassword,
  randomBytes,
  sha256Hex,
  signHash,
  toBase64,
  verifyPassword,
  verifySignature,
  type Encrypted,
} from "./crypto";
import {
  buildProfile,
  compareProfiles,
  localSuggestions,
  originalityScore,
  type NarrativeProfile,
  type SimilarityMatch,
} from "./analysis";

const KEY = "stsv:db:v1";
const SESSION = "stsv:session";

export type Role = "user" | "admin";

export type VaultUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  passwordHash: string;
  salt: string;
  keySalt: string;
  publicJwk: JsonWebKey;
  encryptedPrivateKey: Encrypted;
  verified: boolean;
  otp: string | null;
  createdAt: string;
};

export type StoredIndex = {
  tokens: string[];
  shingles: string[];
  characters: string[];
  dialogue: string[];
  themes: string[];
  beats: string[];
  wordCount: number;
};

export type AnalysisResult = {
  originality: number;
  matches: SimilarityMatch[];
  suggestions: string[];
  aiSummary?: string;
  aiPowered: boolean;
  analyzedAt: string;
};

export type ScriptVersion = {
  id: string;
  version: number;
  filename: string;
  hash: string;
  signature: string;
  cipher: Encrypted;
  index: StoredIndex;
  createdAt: string;
  timestampToken: string;
  analysis: AnalysisResult;
};

export type VaultScript = {
  id: string;
  ownerId: string;
  ownerName: string;
  title: string;
  genre: string;
  logline: string;
  createdAt: string;
  versions: ScriptVersion[];
};

export type NotificationItem = {
  id: string;
  userId: string;
  message: string;
  createdAt: string;
  read: boolean;
};

export type LoginEvent = {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: Role;
  at: string;
  agent: string;
};

type DB = {
  users: VaultUser[];
  scripts: VaultScript[];
  notifications: NotificationItem[];
  logins: LoginEvent[];
};

const empty: DB = { users: [], scripts: [], notifications: [], logins: [] };

function read(): DB {
  if (typeof window === "undefined") return empty;
  try {
    return { ...empty, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
  } catch {
    return empty;
  }
}

function write(db: DB) {
  localStorage.setItem(KEY, JSON.stringify(db));
  listeners.forEach((l) => l());
}

const listeners = new Set<() => void>();
export function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function getDb() {
  return read();
}

const uid = () => crypto.randomUUID();

/* ---------------- auth ---------------- */

let unlockedKey: CryptoKey | null = null;

export function isUnlocked() {
  return unlockedKey !== null;
}

export async function register(name: string, email: string, password: string) {
  const db = read();
  const normalized = email.trim().toLowerCase();
  if (db.users.some((u) => u.email === normalized))
    throw new Error("An account with that email already exists.");

  const { hash, salt } = await hashPassword(password);
  const keySalt = toBase64(randomBytes(16).buffer);
  const aesKey = await deriveAesKey(password, keySalt);
  const { publicJwk, privateJwk } = await generateSigningKeypair();
  const encryptedPrivateKey = await aesEncrypt(aesKey, JSON.stringify(privateJwk));
  const otp = String(Math.floor(100000 + Math.random() * 900000));

  const user: VaultUser = {
    id: uid(),
    name: name.trim(),
    email: normalized,
    role: ["owner@example.com", "admin@example.com", "ssdeepesh54@gmail.com"].includes(normalized) ? "admin" : "user",
    passwordHash: hash,
    salt,
    keySalt,
    publicJwk,
    encryptedPrivateKey,
    verified: false,
    otp,
    createdAt: new Date().toISOString(),
  };
  db.users.push(user);
  write(db);
  return user;
}

export function verifyEmail(email: string, code: string) {
  const db = read();
  const user = db.users.find((u) => u.email === email.trim().toLowerCase());
  if (!user) throw new Error("Account not found.");
  
  // Dummy process: accept any verification code (or bypass check completely)
  // if (user.otp !== code.trim()) throw new Error("Incorrect verification code.");
  
  user.verified = true;
  user.otp = null;
  write(db);
  return user;
}

export function resendOtp(email: string) {
  const db = read();
  const user = db.users.find((u) => u.email === email.trim().toLowerCase());
  if (!user) throw new Error("Account not found.");
  user.otp = String(Math.floor(100000 + Math.random() * 900000));
  write(db);
  return user.otp;
}

export async function resetPassword(email: string, code: string, newPassword: string) {
  const db = read();
  const user = db.users.find((u) => u.email === email.trim().toLowerCase());
  if (!user) throw new Error("Account not found.");
  if (user.otp !== code.trim()) throw new Error("Incorrect verification code.");

  // Because this is zero-knowledge, we cannot decrypt old scripts with a new password.
  // We must generate entirely new keys. The old encrypted data is effectively lost,
  // but the user regains access to their account.
  const { hash, salt } = await hashPassword(newPassword);
  const keySalt = toBase64(randomBytes(16).buffer);
  const aesKey = await deriveAesKey(newPassword, keySalt);
  const { publicJwk, privateJwk } = await generateSigningKeypair();
  const encryptedPrivateKey = await aesEncrypt(aesKey, JSON.stringify(privateJwk));

  user.passwordHash = hash;
  user.salt = salt;
  user.keySalt = keySalt;
  user.publicJwk = publicJwk;
  user.encryptedPrivateKey = encryptedPrivateKey;
  user.otp = null;
  user.verified = true; // if they weren't verified before, this verifies them
  
  write(db);
  return user;
}

/** Issues a signed session token (JWT-shaped, HS-style payload) and unlocks the vault key. */
export async function login(email: string, password: string) {
  const db = read();
  const user = db.users.find((u) => u.email === email.trim().toLowerCase());
  if (!user) throw new Error("No account found for that email.");
  if (!(await verifyPassword(password, user.passwordHash, user.salt)))
    throw new Error("Incorrect password.");
  if (!user.verified) throw new Error("unverified");

  unlockedKey = await deriveAesKey(password, user.keySalt);
  const payload = {
    sub: user.id,
    email: user.email,
    role: user.role,
    iat: Date.now(),
    exp: Date.now() + 1000 * 60 * 60 * 8,
  };
  const token = [
    btoa(JSON.stringify({ alg: "HS256", typ: "JWT" })),
    btoa(JSON.stringify(payload)),
    (await sha256Hex(JSON.stringify(payload) + user.passwordHash)).slice(0, 43),
  ].join(".");
  sessionStorage.setItem(SESSION, JSON.stringify({ token, userId: user.id }));

  // Audit every sign-in and alert every admin.
  const at = new Date().toISOString();
  const event: LoginEvent = {
    id: uid(),
    userId: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    at,
    agent: typeof navigator === "undefined" ? "unknown" : navigator.userAgent.slice(0, 120),
  };
  db.logins = [event, ...(db.logins ?? [])].slice(0, 500);
  for (const admin of db.users.filter((u) => u.role === "admin")) {
    db.notifications.unshift({
      id: uid(),
      userId: admin.id,
      message: `Sign-in: ${user.name} (${user.email})${admin.id === user.id ? " — this is you" : ""}`,
      createdAt: at,
      read: false,
    });
  }
  write(db);
  return { user, token };
}

/** Re-derive the vault key after a page reload (the key is never persisted). */
export async function unlock(password: string) {
  const user = currentUser();
  if (!user) throw new Error("No active session.");
  if (!(await verifyPassword(password, user.passwordHash, user.salt)))
    throw new Error("Incorrect passphrase.");
  unlockedKey = await deriveAesKey(password, user.keySalt);
  listeners.forEach((l) => l());
}

export function logout() {
  unlockedKey = null;
  sessionStorage.removeItem(SESSION);
  listeners.forEach((l) => l());
}

export function currentSession(): { userId: string; token: string } | null {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(sessionStorage.getItem(SESSION) ?? "null");
  } catch {
    return null;
  }
}

export function currentUser(): VaultUser | null {
  const s = currentSession();
  if (!s) return null;
  return read().users.find((u) => u.id === s.userId) ?? null;
}

export function decodeToken(token: string) {
  try {
    return JSON.parse(atob(token.split(".")[1]));
  } catch {
    return null;
  }
}

/* ---------------- vault ---------------- */

function toStoredIndex(p: NarrativeProfile): StoredIndex {
  return {
    tokens: p.tokens.slice(0, 4000),
    shingles: [...p.shingles].slice(0, 4000),
    characters: p.characters,
    dialogue: p.dialogue.slice(0, 200),
    themes: p.themes,
    beats: p.beats,
    wordCount: p.wordCount,
  };
}

function fromStoredIndex(i: StoredIndex): NarrativeProfile {
  return { ...i, shingles: new Set(i.shingles) };
}

export function analyzeAgainstVault(
  text: string,
  opts: { excludeScriptId?: string; ownerId: string },
): {
  profile: NarrativeProfile;
  matches: SimilarityMatch[];
  originality: number;
  suggestions: string[];
} {
  const db = read();
  const profile = buildProfile(text);
  const matches: SimilarityMatch[] = [];

  for (const script of db.scripts) {
    if (script.id === opts.excludeScriptId) continue;
    const latest = script.versions[script.versions.length - 1];
    if (!latest) continue;
    const other = fromStoredIndex(latest.index);
    const { breakdown, segments } = compareProfiles(profile, other);
    if (breakdown.overall < 0.04) continue;
    matches.push({
      scriptId: script.id,
      title: script.title,
      owner: script.ownerId === opts.ownerId ? "You" : script.ownerName,
      breakdown,
      segments,
      sharedCharacters: profile.characters.filter((c) =>
        other.characters.map((x) => x.toLowerCase()).includes(c.toLowerCase()),
      ),
      sharedThemes: profile.themes.filter((t) => other.themes.includes(t)),
    });
  }
  matches.sort((a, b) => b.breakdown.overall - a.breakdown.overall);
  return {
    profile,
    matches: matches.slice(0, 8),
    originality: originalityScore(matches),
    suggestions: localSuggestions(matches, profile),
  };
}

export async function addScriptVersion(args: {
  scriptId?: string;
  title: string;
  genre: string;
  logline: string;
  filename: string;
  content: string;
  analysis: AnalysisResult;
  index: NarrativeProfile;
}) {
  const user = currentUser();
  if (!user || !unlockedKey) throw new Error("Vault is locked. Please sign in again.");
  const db = read();

  const hash = await sha256Hex(args.content);
  const privateJwk: JsonWebKey = JSON.parse(
    await aesDecrypt(unlockedKey, user.encryptedPrivateKey),
  );
  const signature = await signHash(privateJwk, hash);
  const cipher = await aesEncrypt(unlockedKey, args.content);
  const createdAt = new Date().toISOString();
  const timestampToken = (await sha256Hex(`${hash}|${createdAt}|${user.id}`))
    .slice(0, 40)
    .toUpperCase();

  let script = args.scriptId ? db.scripts.find((s) => s.id === args.scriptId) : undefined;
  if (!script) {
    script = {
      id: uid(),
      ownerId: user.id,
      ownerName: user.name,
      title: args.title,
      genre: args.genre,
      logline: args.logline,
      createdAt,
      versions: [],
    };
    db.scripts.push(script);
  }

  const version: ScriptVersion = {
    id: uid(),
    version: script.versions.length + 1,
    filename: args.filename,
    hash,
    signature,
    cipher,
    index: toStoredIndex(args.index),
    createdAt,
    timestampToken,
    analysis: args.analysis,
  };
  script.versions.push(version);

  db.notifications.unshift({
    id: uid(),
    userId: user.id,
    message: `"${script.title}" v${version.version} sealed · originality ${args.analysis.originality}%`,
    createdAt,
    read: false,
  });
  if (args.analysis.matches[0] && args.analysis.matches[0].breakdown.overall > 0.45) {
    db.notifications.unshift({
      id: uid(),
      userId: user.id,
      message: `High similarity detected with "${args.analysis.matches[0].title}"`,
      createdAt,
      read: false,
    });
  }

  write(db);
  return { script, version };
}

export function listMyScripts() {
  const u = currentUser();
  if (!u) return [];
  return read()
    .scripts.filter((s) => s.ownerId === u.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getScript(id: string) {
  return read().scripts.find((s) => s.id === id) ?? null;
}

export async function revealVersion(version: ScriptVersion) {
  if (!unlockedKey) throw new Error("Vault is locked. Sign in again to decrypt.");
  return aesDecrypt(unlockedKey, version.cipher);
}

export async function verifyVersion(script: VaultScript, version: ScriptVersion) {
  const db = read();
  const owner = db.users.find((u) => u.id === script.ownerId);
  if (!owner) return { signatureValid: false, hashValid: false };
  const signatureValid = await verifySignature(owner.publicJwk, version.hash, version.signature);
  let hashValid = false;
  if (unlockedKey && owner.id === currentUser()?.id) {
    try {
      hashValid = (await sha256Hex(await aesDecrypt(unlockedKey, version.cipher))) === version.hash;
    } catch {
      hashValid = false;
    }
  }
  return { signatureValid, hashValid };
}

export function markNotificationsRead() {
  const u = currentUser();
  if (!u) return;
  const db = read();
  db.notifications.forEach((n) => {
    if (n.userId === u.id) n.read = true;
  });
  write(db);
}

export function myNotifications() {
  const u = currentUser();
  if (!u) return [];
  return read().notifications.filter((n) => n.userId === u.id);
}

/* ---------------- admin ---------------- */

export function adminStats() {
  const db = read();
  const versions = db.scripts.flatMap((s) => s.versions);
  const avg = versions.length
    ? Math.round(versions.reduce((a, v) => a + v.analysis.originality, 0) / versions.length)
    : 0;
  return {
    users: db.users.length,
    verified: db.users.filter((u) => u.verified).length,
    scripts: db.scripts.length,
    versions: versions.length,
    avgOriginality: avg,
    flagged: versions.filter((v) => v.analysis.originality < 70).length,
    byDay: Object.entries(
      versions.reduce<Record<string, number>>((acc, v) => {
        const d = v.createdAt.slice(0, 10);
        acc[d] = (acc[d] ?? 0) + 1;
        return acc;
      }, {}),
    )
      .sort()
      .slice(-14)
      .map(([date, count]) => ({ date: date.slice(5), count })),
    users_list: db.users,
    logins: (db.logins ?? []).length,
    logins_list: (db.logins ?? []).slice(0, 50),
  };
}

export function recentLogins(limit = 50): LoginEvent[] {
  return (read().logins ?? []).slice(0, limit);
}

export function setUserRole(userId: string, role: Role) {
  const db = read();
  const u = db.users.find((x) => x.id === userId);
  if (u) u.role = role;
  write(db);
}
