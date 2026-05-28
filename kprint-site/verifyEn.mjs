import { chromium } from "playwright";

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

console.log("→ /kprint-2026/en/sponsorships");
await page.goto("https://eandex.cloud/kprint-2026/en/sponsorships", { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(8000);

const enUrl = page.url();
console.log(`URL: ${enUrl}`);

// Category card shortDesc text — find paragraphs near titles
const cardTexts = await page.locator("p.line-clamp-2, p.text-ink-500").allInnerTexts();
const sample = cardTexts.filter(t => t && t.length > 20).slice(0, 8);
console.log(`\nCard descriptions (first 8):`);
sample.forEach((t, i) => console.log(`  [${i}] ${t.slice(0, 80)}`));

// Toggle highlight
const koBtn = page.locator('a[href$="/sponsorships"]').filter({ hasText: /^KO$/ }).first();
const enBtn = page.locator('a[href$="/en/sponsorships"]').filter({ hasText: /^EN$/ }).first();
const enClasses = await enBtn.getAttribute("class").catch(() => null);
const koClasses = await koBtn.getAttribute("class").catch(() => null);
console.log(`\nToggle classes:`);
console.log(`  EN: ${enClasses}`);
console.log(`  KO: ${koClasses}`);

await page.screenshot({ path: "/tmp/en-sp.png", fullPage: false });
console.log(`\nScreenshot: /tmp/en-sp.png`);

// Click KO toggle
console.log(`\n→ Click KO toggle`);
await koBtn.click();
await page.waitForTimeout(2500);

const koUrl = page.url();
console.log(`URL after click: ${koUrl}`);

const koCardTexts = await page.locator("p.line-clamp-2, p.text-ink-500").allInnerTexts();
const koSample = koCardTexts.filter(t => t && t.length > 20).slice(0, 8);
console.log(`\nCard descriptions after KO toggle:`);
koSample.forEach((t, i) => console.log(`  [${i}] ${t.slice(0, 80)}`));

await page.screenshot({ path: "/tmp/ko-sp.png", fullPage: false });
console.log(`\nScreenshot: /tmp/ko-sp.png`);

await browser.close();
