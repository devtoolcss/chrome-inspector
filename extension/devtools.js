import { getAbsoluteXPath } from "./xpath.js";

function sendSelector() {
  // TODO: debug mode
  const expression = `
(function() {
  ${getAbsoluteXPath.toString()}

  const sender = $0.ownerDocument.defaultView.__chrome_inspector_send_$0_xpath;
  if (typeof sender !== "function") return;
  try{
    const xpath = getAbsoluteXPath($0);
    sender(xpath);
  } catch {}
})();
`;

  chrome.devtools.inspectedWindow.eval(
    expression,
    {},
    (_result, exceptionInfo) => {
      if (exceptionInfo && exceptionInfo.isException) {
        console.error(
          `Unable to evaluate selection change script.`,
          exceptionInfo,
        );
      }
    },
  );
}

if (chrome?.devtools?.panels?.elements) {
  chrome.devtools.panels.elements.onSelectionChanged.addListener(sendSelector);
} else {
  console.warn(`chrome.devtools API is not available in this context.`);
}
