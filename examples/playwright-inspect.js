import { chromium } from "playwright";
import { Inspector } from "chrome-inspector";

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();

await page.goto("https://example.com", { waitUntil: "domcontentloaded" });

// Playwright CDP session
const client = await context.newCDPSession(page);
const inspector = await Inspector.fromCDPClient(client);

// Inspect an element
const body = inspector.querySelector("body");

const styles = await body.getMatchedStyles();
console.log("Matched Rules:");
console.log(JSON.stringify(styles, null, 2));

const computed = await body.getComputedStyle();
console.log("Computed Styles:");
for (const key of ["background-color", "width", "margin-left"]) {
  console.log(`${key}:`, computed[key]);
}

await browser.close();
