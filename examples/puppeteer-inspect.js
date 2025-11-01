import puppeteer from "puppeteer";
import { Inspector } from "chrome-inspector";

const browser = await puppeteer.launch({
  headless: true,
});
const page = await browser.newPage();

await page.goto("https://example.com", { waitUntil: "domcontentloaded" });

// Puppeteer CDP client
const client = await page.createCDPSession();
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
