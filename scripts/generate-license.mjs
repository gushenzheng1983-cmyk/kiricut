#!/usr/bin/env node
/**
 * 本地发卡（方案一人工发码）
 *
 * 用法：
 *   node scripts/generate-license.mjs month
 *   node scripts/generate-license.mjs year
 *   node scripts/generate-license.mjs trial
 *   node scripts/generate-license.mjs month 2026-08-31
 *   node scripts/generate-license.mjs year --count 5
 */

import { createHash, randomBytes } from "node:crypto";

const LICENSE_SECRET = "kiricut-v1-domestic-pay-2026";

function formatYmd(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

function parsePlan(arg) {
  const a = String(arg || "").toLowerCase();
  if (a === "month" || a === "m" || a === "monthly") return "M";
  if (a === "year" || a === "y" || a === "yearly") return "Y";
  if (a === "trial" || a === "t") return "T";
  return null;
}

function expiryFor(plan, explicit) {
  if (explicit) {
    const cleaned = explicit.replace(/-/g, "");
    if (!/^\d{8}$/.test(cleaned)) {
      throw new Error(`Invalid expiry date: ${explicit} (use YYYY-MM-DD)`);
    }
    return cleaned;
  }
  const d = new Date();
  if (plan === "M") d.setMonth(d.getMonth() + 1);
  else if (plan === "Y") d.setFullYear(d.getFullYear() + 1);
  else d.setDate(d.getDate() + 90);
  return formatYmd(d);
}

function sign(plan, expiryYmd, nonce) {
  return createHash("sha256")
    .update(`${LICENSE_SECRET}|${plan}|${expiryYmd}|${nonce}`)
    .digest("hex")
    .slice(0, 8)
    .toUpperCase();
}

function makeCode(plan, expiryYmd) {
  const nonce = randomBytes(2).toString("hex").toUpperCase();
  return `KC-${plan}-${expiryYmd}-${nonce}-${sign(plan, expiryYmd, nonce)}`;
}

const args = process.argv.slice(2);
const plan = parsePlan(args[0]);
if (!plan) {
  console.error(`Usage:
  node scripts/generate-license.mjs month
  node scripts/generate-license.mjs year
  node scripts/generate-license.mjs trial
  node scripts/generate-license.mjs month 2026-08-31
  node scripts/generate-license.mjs year --count 5

Transition codes (hardcoded in app):
  KC-BETA-2026-THANKS   (trial until 2026-09-30)
  KC-BETA-FRIEND-PASS   (trial until 2026-09-30)`);
  process.exit(1);
}

let expiryArg = null;
let count = 1;
for (let i = 1; i < args.length; i++) {
  if (args[i] === "--count" && args[i + 1]) {
    count = Math.max(1, Number(args[i + 1]) || 1);
    i++;
  } else if (!args[i].startsWith("--")) {
    expiryArg = args[i];
  }
}

const expiryYmd = expiryFor(plan, expiryArg);
const label = plan === "M" ? "月卡" : plan === "Y" ? "年卡" : "试用";

console.log(
  `# KiriCut ${label} · 到期 ${expiryYmd.slice(0, 4)}-${expiryYmd.slice(4, 6)}-${expiryYmd.slice(6, 8)}`
);
for (let i = 0; i < count; i++) {
  console.log(makeCode(plan, expiryYmd));
}
