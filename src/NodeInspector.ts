import { Inspector, InspectorOptions, CDPClient } from "./Inspector.js";

let JSDOM: typeof import("jsdom").JSDOM;
let documentImpl: DOMImplementation;

async function initDocumentImpl() {
  if (!documentImpl) {
    JSDOM = (await import("jsdom")).JSDOM;
    documentImpl = new JSDOM("<!DOCTYPE html>").window.document.implementation;
  }
}

export class NodeInspector extends Inspector {
  static async fromCDPClient(
    client: CDPClient,
    options: InspectorOptions = {},
  ): Promise<NodeInspector> {
    const sendCommand = (method: string, params?: any) =>
      client.send(method, params);
    const onCDP = (event: string, callback: (data: any) => void) =>
      client.on(event, callback);
    const offCDP = (event: string, callback: (data: any) => void) =>
      client.off(event, callback);

    if (!options.documentImpl) {
      await initDocumentImpl();
      options.documentImpl = documentImpl;
    }

    const inspector = new NodeInspector(sendCommand, onCDP, offCDP, options);
    await inspector.init();
    await inspector.initDOM();
    return inspector;
  }
}
