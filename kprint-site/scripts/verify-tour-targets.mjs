/**
 * 투어·따라하기 대상 점검 — lib/admin/onboarding.ts 의 target / advance.target 이
 * 실제 화면 코드에 data-tour 로 달려 있는지 확인한다 (오타·빠진 표시 방지).
 *
 * 실행: cd kprint-site && node scripts/verify-tour-targets.mjs
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const src = readFileSync("lib/admin/onboarding.ts", "utf8");
const wanted = new Set();
for (const m of src.matchAll(/target:\s*"([a-z0-9-]+)"/g)) wanted.add(m[1]);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx|ts)$/.test(name) && !p.endsWith("onboarding.ts")) out.push(p);
  }
  return out;
}
const files = [...walk("app"), ...walk("components")];
const found = new Map();
for (const f of files) {
  const s = readFileSync(f, "utf8");
  // data-tour="x" · tour="x" (Section prop) · tour: "x" (사이드바 메뉴) · data-tour={조건 ? "x" : …}
  const patterns = [/(?:data-tour|tour)\s*[=:]\s*"([a-z0-9-]+)"/g, /data-tour=\{[^}]*?"([a-z0-9-]+)"/g];
  for (const re of patterns) {
    for (const m of s.matchAll(re)) {
      if (!found.has(m[1])) found.set(m[1], f);
    }
  }
}

let ok = 0;
const missing = [];
for (const t of [...wanted].sort()) {
  if (found.has(t)) ok++;
  else missing.push(t);
}
console.log(`대상 ${wanted.size}개 중 ${ok}개 확인`);
if (missing.length) {
  console.log("화면에 없는 대상:", missing.join(", "));
  process.exit(1);
}
