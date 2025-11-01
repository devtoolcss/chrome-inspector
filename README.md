# Chrome Inspector

A programming interface that makes DevTools automation simple. It uses the Chrome DevTools Protocol (CDP) — the same API that Chrome DevTools uses — to provide access to Elements and Styles panel information, and more.

It works by maintaining a DOM mirror of the inspected page and wrapping the boilerplate CDP calls into convenient methods for DOM nodes and elements. The goal is to offer a lightweight alternative to [devtools-frontend's sdk](https://github.com/ChromeDevTools/devtools-frontend/tree/main/front_end/core/sdk).

## Installation

```bash
npm i chrome-inspector
```

## Usage

```ts
import { Inspector } from "chrome-inspector";

// Init backend and load a page...

// Puppeteer
const client = await page.createCDPSession();
const inspector = await Inspector.fromCDPClient(client);

// Playwright
const client = await page.context().newCDPSession(page);
const inspector = await Inspector.fromCDPClient(client);

// Chrome Extension
const target = { tabId: chrome.devtools.inspectedWindow.tabId };
await chrome.debugger.attach(target, "1.3");
const inspector = await Inspector.fromChromeDebugger(
  chrome.debugger,
  target.tabId,
);

// Inspect an element
const body = inspector.querySelector("body");

const styles = await body.getMatchedStyles();
console.log("Matched Rules:");
console.log(JSON.stringify(styles, null, 2));

/*
Containing rules like:
{
  "allSelectors": ["body"],
  "matchedSelectors": ["body"],
  "properties": [
    {"name": "background","value": "#eee","important": false,"applied": true},
    ...
  ],
  "origin": "regular",
  "cssText": "background:#eee;..."
}
*/

const computed = await body.getComputedStyle();
console.log("Computed Styles:");
for (const key of ["background-color", "width", "margin-left"]) {
  console.log(`${key}:`, computed[key]);
}

// Read elements like in browser
const bodyHtml = body.outerHTML;
const html = body.parentNode;
const h1 = body.querySelector("h1");

// Mutate elements asynchronously (experimental)
await h1.remove();
await body.querySelector("a").click();

// After DOM changes, check if element references are still valid.
console.log(body.tracked); // false
```

See `examples/` for full scripts.
