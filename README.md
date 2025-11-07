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

// Read elements in DOM syntax
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

## Sync $0 (experimental)

To use `inspector.$0`, install the extension in [./extension](./extension)`. Also avaliable on [chrome web store](https://chromewebstore.google.com/detail/chrome-inspector-sync/jgiapjeogionjfbonpiamipcedcnohha).

The extension is included in the package. Import `CHROME_INSPECTOR_SYNC_EXTENSION_PATH` to get its path. This is useful for automation frameworks like Puppeteer or Playwright to launch with extensions.

## TODO

1. CSS properties add/edit
   - Key CDP commands: `CSS.addRule`, `CSS.setStyleSheetText`, `CSS.getStyleSheetText`
   - Use raw response's [StyleSheetId](https://chromedevtools.github.io/devtools-protocol/tot/CSS/#type-StyleSheetId) and [SourceRange](https://chromedevtools.github.io/devtools-protocol/tot/CSS/#type-SourceRange)
2. Better DOM mutation API support
   - Many setters like `.outerHTML = ...` cannot be async. Possibly have to be `setOuterHTML()`?
3. Shadow DOM support
4. Other debugging utilities (ex: console message as event, DOM breakpoint, etc)

## Contributing

We welcome contributions in any form, including bug reports, pull requests, feature requests, and more.

For pull requests, please use [conventional commits](https://conventionalcommits.org/).
