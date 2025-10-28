# Chrome Inspector

A lightweight interface for Chrome Inspector, providing Elements and Styles Panel information via the Chrome DevTools Protocol (CDP). Supports Puppeteer, Playwright, Chrome Extensions, and other CDP clients.

## Installation

```bash
npm i chrome-inspector
```

## Usage

```ts
import { Inspector } from "chrome-inspector";

// Init backend...

// Puppeteer
const client = await page.createCDPSession();
const inspector = Inspector.fromCDPClient(client);

// Playwright
const client = await page.context().newCDPSession(page);
const inspector = Inspector.fromCDPClient(client);

// Chrome Extension
const target = { tabId: chrome.devtools.inspectedWindow.tabId };
await chrome.debugger.attach(target, "1.3");
const inspector = Inspector.fromChromeDebugger(chrome.debugger, target.tabId);

// Load a page...

// Inspect element by query selector
const node = await inspector.inspect("body");

console.log("Matched Rules:");
console.log(JSON.stringify(node.styles, null, 2));

console.log("Computed Styles:");
for (const key of ["background-color", "width", "margin-left"]) {
  console.log(`${key}:`, node.computed[key]);
}
```

Full example:

Sample output for [https://example.com](https://example.com) (formatted):

```json
Styles:
{
  "inherited": [],
  "attributes": [],
  "matched": [
    {
      "allSelectors": ["body"],
      "matchedSelectors": ["body"],
      "properties": [
        {"name": "display","value": "block","important": false,"applied": true},
        {"name": "margin","value": "8px","important": false,"applied": false}
      ],
      "origin": "user-agent"
    },
    {
      "allSelectors": ["body"],
      "matchedSelectors": ["body"],
      "properties": [
        {"name": "background","value": "#eee","important": false,"applied": true},
        {"name": "width","value": "60vw","important": false,"applied": true},
        {"name": "margin","value": "15vh auto","important": false,"applied": true},
        {"name": "font-family","value": "system-ui,sans-serif","important": false,"applied": false}
      ],
      "origin": "regular",
      "cssText": "background:#eee;width:60vw;margin:15vh auto;font-family:system-ui,sans-serif"
    }
  ],
  "pseudoElements": [],
  "inline": []
}
Computed:
background-color: rgb(238, 238, 238)
width: 480px
margin-left: 160px

```

## APIs

- The returned `Node` is a CDP [DOM.Node](https://chromedevtools.github.io/devtools-protocol/tot/DOM/#type-Node) object containing DOM information. Loosely typed for compatibility.

- The rules are ordered by specificity from lowest to highest. `apply: true` marks final applied properties. For more details check `@devtoolcss/parser`

- The Document is native DOM in browser and JSDOM in node. To use a specific document you can pass it in. It always returns a new document instance created from `document.implementation.createHTMLDocument()`.
