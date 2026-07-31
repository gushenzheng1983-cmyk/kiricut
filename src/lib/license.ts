import { LICENSE_SECRET, type PlanId } from "./pricing";

const STORAGE_KEY = "kiricut-license";

export type StoredLicense = {
  code: string;
  plan: PlanId;
  expiresAt: string; // YYYY-MM-DD
  activatedAt: string; // ISO
};

/** 内测过渡码（验签旁路，到期后失效） */
const TRANSITION_CODES: Record<string, { plan: PlanId; expiresAt: string }> = {
  "KC-BETA-2026-THANKS": { plan: "T", expiresAt: "2026-09-30" },
  "KC-BETA-FRIEND-PASS": { plan: "T", expiresAt: "2026-09-30" },
};

function normalizeCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

function parseExpiryYmd(ymd: string): Date {
  const y = Number(ymd.slice(0, 4));
  const m = Number(ymd.slice(4, 6));
  const d = Number(ymd.slice(6, 8));
  return new Date(y, m - 1, d, 23, 59, 59, 999);
}

function formatYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

function ymdToIsoDate(ymd: string): string {
  return `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`;
}

async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function signPayload(
  plan: PlanId,
  expiryYmd: string,
  nonce: string
): Promise<string> {
  const hex = await sha256Hex(`${LICENSE_SECRET}|${plan}|${expiryYmd}|${nonce}`);
  return hex.slice(0, 8).toUpperCase();
}

export function buildLicenseCode(
  plan: PlanId,
  expiryYmd: string,
  nonce: string,
  sig: string
): string {
  return `KC-${plan}-${expiryYmd}-${nonce}-${sig}`;
}

export function expiryYmdForPlan(plan: PlanId, from = new Date()): string {
  const d = new Date(from);
  if (plan === "M") d.setMonth(d.getMonth() + 1);
  else if (plan === "Y") d.setFullYear(d.getFullYear() + 1);
  else d.setDate(d.getDate() + 90);
  return formatYmd(d);
}

export function randomNonce(): string {
  const bytes = new Uint8Array(2);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

type ParsedCode =
  | {
      ok: true;
      plan: PlanId;
      expiryYmd: string;
      nonce: string;
      sig: string;
      transition?: boolean;
    }
  | { ok: false; reason: string };

function parseCodeStructure(code: string): ParsedCode {
  const transition = TRANSITION_CODES[code];
  if (transition) {
    return {
      ok: true,
      plan: transition.plan,
      expiryYmd: transition.expiresAt.replace(/-/g, ""),
      nonce: "BETA",
      sig: "TRANSITION",
      transition: true,
    };
  }

  const m = /^KC-([MYT])-(\d{8})-([A-F0-9]{4})-([A-F0-9]{8})$/.exec(code);
  if (!m) return { ok: false, reason: "invalid_format" };
  return {
    ok: true,
    plan: m[1] as PlanId,
    expiryYmd: m[2],
    nonce: m[3],
    sig: m[4],
  };
}

export async function verifyLicenseCode(
  raw: string
): Promise<{ ok: true; plan: PlanId; expiresAt: string } | { ok: false; reason: string }> {
  const code = normalizeCode(raw);
  if (!code) return { ok: false, reason: "empty" };

  const parsed = parseCodeStructure(code);
  if (!parsed.ok) return parsed;

  if (!parsed.transition) {
    const expected = await signPayload(parsed.plan, parsed.expiryYmd, parsed.nonce);
    if (expected !== parsed.sig) return { ok: false, reason: "bad_signature" };
  }

  const expires = parseExpiryYmd(parsed.expiryYmd);
  if (Date.now() > expires.getTime()) return { ok: false, reason: "expired" };

  return {
    ok: true,
    plan: parsed.plan,
    expiresAt: ymdToIsoDate(parsed.expiryYmd),
  };
}

export function readStoredLicense(): StoredLicense | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredLicense;
    if (!parsed?.code || !parsed?.expiresAt || !parsed?.plan) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearLicense(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

export function isLicenseActive(license: StoredLicense | null = readStoredLicense()): boolean {
  if (!license) return false;
  const end = new Date(`${license.expiresAt}T23:59:59`);
  return Date.now() <= end.getTime();
}

export function isPro(): boolean {
  return isLicenseActive();
}

export async function activateCode(
  raw: string
): Promise<{ ok: true; license: StoredLicense } | { ok: false; reason: string }> {
  const verified = await verifyLicenseCode(raw);
  if (!verified.ok) return verified;

  const license: StoredLicense = {
    code: normalizeCode(raw),
    plan: verified.plan,
    expiresAt: verified.expiresAt,
    activatedAt: new Date().toISOString(),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(license));
  return { ok: true, license };
}

export function getLicenseSummary(): {
  isPro: boolean;
  plan: PlanId | null;
  expiresAt: string | null;
} {
  const lic = readStoredLicense();
  if (!isLicenseActive(lic) || !lic) {
    return { isPro: false, plan: null, expiresAt: null };
  }
  return { isPro: true, plan: lic.plan, expiresAt: lic.expiresAt };
}
