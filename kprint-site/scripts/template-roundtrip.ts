/**
 * 양식 생성 → 파서 → 결과 출력. STEP 5-2 round-trip 검증용.
 * 실행: cd kprint-site && npx tsx scripts/template-roundtrip.ts
 */

import { generateTemplateBuffer } from "../lib/excel/template";
import { parseExcelBuffer } from "../lib/excel/parser";

async function main() {
const buf = await generateTemplateBuffer();
console.log(`✓ generateTemplateBuffer() → ${buf.length} bytes\n`);

const result = parseExcelBuffer(buf);

console.log("summary:", result.summary);
console.log();

if (result.errors.length > 0) {
  console.log("errors:");
  for (const e of result.errors) {
    console.log(`  row ${e.rowIndex} [${e.column ?? "-"}]: ${e.reason}`);
  }
  console.log();
}

if (result.warnings.length > 0) {
  console.log("warnings:");
  for (const w of result.warnings) {
    console.log(`  row ${w.rowIndex ?? "-"} [${w.column ?? "-"}]: ${w.reason}`);
  }
  console.log();
}

console.log(
  `categories (${result.categories.length}):`,
  result.categories
    .map((c) => `${c.code}(${c.type})`)
    .join(", ")
);
console.log(
  `subcategories (${result.subcategories.length}):`,
  result.subcategories
    .map((s) => `${s.categoryCode}/${s.nameKo || "(default)"} ${s.priceKRW}원`)
    .join(", ")
);
console.log(
  `slots (${result.slots.length}):`,
  result.slots.map((s) => `${s.code}${s.isSold ? "(sold)" : ""}`).join(", ")
);

console.log();
if (result.ok) {
  console.log("✓ Round-trip OK — errors 0건, 양식이 parser에 깔끔히 들어감");
  process.exit(0);
} else {
  console.log("✗ Round-trip FAILED");
  process.exit(1);
}
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
