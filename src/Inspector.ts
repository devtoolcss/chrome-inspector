import { parseGetMatchedStylesForNodeResponse } from "@devtoolcss/parser";
import { CDPNodeType } from "./constants.js";
import { InspectorElement, InspectorNode } from "./InspectorDOM.js";
import EventEmitter from "./EventEmitter.js";
import type { ParseOptions, ParsedCSS } from "@devtoolcss/parser";
import {
  CDPNode,
  Device,
  GetComputedStyleForNodeResponse,
  GetMatchedStylesForNodeResponse,
} from "./types.js";
import highlightConfig from "./highlightConfig.js";

let JSDOM: any = null;

if (typeof window === "undefined") {
  const s = "jsdom"; // somehow have to do this to avoid bundler issue
  JSDOM = (await import(s)).JSDOM;
}

function findNodeIdx(nodes: CDPNode[], nodeId: number): number {
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i].nodeId === nodeId) {
      return i;
    }
  }
  return null;
}

type CDPClient = {
  send: (method: string, params?: object) => Promise<any>;
  on: (event: string, callback: (data: any) => void) => void;
  off: (event: string, callback: (data: any) => void) => void;
};

type InspectorOptions = {
  documentImpl?: DOMImplementation;
  eventTimeout?: number;
};

export type MatchedStylesOptions = {
  raw?: boolean;
  parseOptions?: ParseOptions;
};

export type ComputedStyleOptions = {
  raw?: boolean;
};

function nsResolver(prefix) {
  const ns = {
    svg: "http://www.w3.org/2000/svg",
    xhtml: "http://www.w3.org/1999/xhtml",
  };
  return ns[prefix] || null;
}

// we need EventEmitter for warning events, which can happen
// anytime event fired
export class Inspector extends EventEmitter {
  // fixed document object reference
  protected documentImpl: DOMImplementation;
  protected eventTimeout: number;

  protected document: Document;

  protected selectedNode: InspectorNode | undefined;
  get $0(): InspectorNode | undefined {
    if (this.selectedNode && this.selectedNode.tracked) {
      return this.selectedNode;
    }
    return undefined;
  }

  querySelector(selector: string): InspectorElement | null {
    const el = this.document.querySelector(selector);
    return el ? InspectorElement.get(el) : null;
  }

  querySelectorAll(selector: string): InspectorElement[] {
    return Array.from(this.document.querySelectorAll(selector)).map(
      InspectorElement.get,
    );
  }

  queryXPath(xpath: string): InspectorNode | null {
    const result = this.document.evaluate(
      xpath,
      this.document,
      nsResolver,
      9, //XPathResult.FIRST_ORDERED_NODE_TYPE
      null,
    );
    const node = result.singleNodeValue;
    return node ? InspectorNode.get(node) : null;
  }

  queryXPathAll(xpath: string): InspectorNode[] {
    const result = this.document.evaluate(
      xpath,
      this.document,
      nsResolver,
      7, //XPathResult.ORDERED_NODE_SNAPSHOT_TYPE
      null,
    );
    const nodes: InspectorNode[] = [];
    for (let i = 0; i < result.snapshotLength; i++) {
      const node = result.snapshotItem(i);
      if (node) {
        const inspectorNode = InspectorNode.get(node);
        if (inspectorNode) {
          nodes.push(inspectorNode);
        }
      }
    }
    return nodes;
  }

  protected idToNode = new Map<number, InspectorNode>();

  readonly sendCommand: (method: string, params?: object) => Promise<any>;

  readonly onCDP: (event: string, callback: (data: any) => void) => void;

  readonly offCDP: (event: string, callback: (data: any) => void) => void;

  // describeNode depth -1 is buggy, often return nodeId=0, causing bug
  // devtools use DOM.requestChildNodes and receive the results from DOM.setChildNodes event
  // devtools-frontend just await DOM.requestChildNodes, but for safety we also await the event
  protected async getChildren(node: CDPNode): Promise<void> {
    const childrenPromise = new Promise<void>((resolve) => {
      // if no children to request, also good
      const timeoutId = setTimeout(() => {
        this.offCDP("DOM.setChildNodes", handler);
        resolve();
      }, this.eventTimeout);

      let handler: (data: { parentId: number; nodes: CDPNode[] }) => void;
      handler = (data: { parentId: number; nodes: CDPNode[] }) => {
        if (node.nodeId !== data.parentId) return;
        node.children = data.nodes;
        this.offCDP("DOM.setChildNodes", handler);
        clearTimeout(timeoutId);
        this.emit("DOM.setChildNodes", data);
        resolve();
      };

      this.onCDP("DOM.setChildNodes", handler);
    });
    await this.sendCommand("DOM.requestChildNodes", {
      nodeId: node.nodeId,
      depth: -1,
    });
    await childrenPromise;
  }

  protected emitWarning(w: string) {
    this.emit("warning", w);
  }

  protected constructor(
    sendCommand: (method: string, params?: any) => Promise<any>,
    onCDP: (event: string, callback: (data: any) => void) => void,
    offCDP: (event: string, callback: (data: any) => void) => void,
    options: InspectorOptions = {},
  ) {
    super();
    this.sendCommand = sendCommand;
    this.onCDP = onCDP;
    this.offCDP = offCDP;

    if (options.documentImpl) {
      this.documentImpl = options.documentImpl;
    } else {
      this.documentImpl = JSDOM
        ? new JSDOM("<!DOCTYPE html>").window.document.implementation
        : window.document.implementation;
    }
    this.eventTimeout = options.eventTimeout || 100;
  }

  // factory methods

  static async fromCDPClient(
    client: CDPClient,
    options: InspectorOptions,
  ): Promise<Inspector> {
    const sendCommand = (method: string, params?: any) =>
      client.send(method, params);
    const onCDP = (event: string, callback: (data: any) => void) =>
      client.on(event, callback);
    const offCDP = (event: string, callback: (data: any) => void) =>
      client.off(event, callback);

    const inspector = new Inspector(sendCommand, onCDP, offCDP, options);
    await inspector.init();
    await inspector.initDOM();
    return inspector;
  }

  static async fromChromeDebugger(
    chromeDebugger: typeof chrome.debugger,
    tabId: number,
    options: InspectorOptions,
  ): Promise<Inspector> {
    const sendCommand = async (method: string, params?: any) =>
      chromeDebugger.sendCommand({ tabId }, method, params);
    // storing wrappers to allow off
    const listenerMap = new Map<
      (data: any) => void,
      (source: any, method: string, params: any) => void
    >();
    const onCDP = (event: string, callback: (data: any) => void) => {
      const wrapper = (source, method, params) => {
        if (source.tabId === tabId && method === event) {
          callback(params);
        }
      };
      listenerMap.set(callback, wrapper);
      chromeDebugger.onEvent.addListener(wrapper);
    };
    const offCDP = (event: string, callback: (data: any) => void) => {
      const wrapper = listenerMap.get(callback);
      if (wrapper) {
        chromeDebugger.onEvent.removeListener(wrapper);
        listenerMap.delete(callback);
      }
    };
    const inspector = new Inspector(sendCommand, onCDP, offCDP, options);
    await inspector.init();
    await inspector.initDOM();
    return inspector;
  }

  // centralized map operations
  protected setMap(nodeId: number, node: InspectorNode): void {
    this.idToNode.set(nodeId, node);
  }

  protected deleteMap(nodeId: number, recursive: boolean = true): void {
    const node = this.idToNode.get(nodeId);
    if (!node) {
      this.emitWarning(`deleteMap: no node for nodeId ${nodeId}`);
      return;
    }
    this.idToNode.delete(nodeId);

    if (recursive && node._cdpNode.children) {
      for (const child of node._cdpNode.children) {
        this.deleteMap(child.nodeId, true);
      }
    }
  }

  protected buildNodeTree(cdpNode: CDPNode): Node | null {
    let docNode: Node;

    switch (cdpNode.nodeType) {
      case CDPNodeType.ELEMENT_NODE:
        // iframe is safe because no children (not setting pierce)
        docNode = this.document.createElement(cdpNode.localName);

        if (Array.isArray(cdpNode.attributes)) {
          for (let i = 0; i < cdpNode.attributes.length; i += 2) {
            (docNode as HTMLElement).setAttribute(
              cdpNode.attributes[i],
              cdpNode.attributes[i + 1],
            );
          }
        }
        break;

      case CDPNodeType.TEXT_NODE:
        docNode = this.document.createTextNode(cdpNode.nodeValue || "");
        break;

      case CDPNodeType.COMMENT_NODE:
        docNode = this.document.createComment(cdpNode.nodeValue || "");
        break;

      case CDPNodeType.DOCUMENT_NODE:
        this.document = this.documentImpl.createHTMLDocument();
        this.document.removeChild(this.document.documentElement);
        docNode = this.document;
        break;

      default:
        return null;
    }

    // Recursively add children
    if (cdpNode.children) {
      for (const child of cdpNode.children) {
        const childNode = this.buildNodeTree(child);
        if (childNode) docNode.appendChild(childNode);
      }
    }

    // The only place to new InspectorNode/Element
    const node =
      docNode.nodeType === CDPNodeType.ELEMENT_NODE ||
      docNode.nodeType === CDPNodeType.DOCUMENT_NODE
        ? new InspectorElement(docNode as Element, cdpNode, this)
        : new InspectorNode(docNode, cdpNode, this);
    this.setMap(cdpNode.nodeId, node);

    return docNode;
  }

  protected onAttributeModified(params: {
    nodeId: number;
    name: string;
    value: string;
  }) {
    const node = this.idToNode.get(params.nodeId);
    if (!node) {
      this.emitWarning(
        `onAttributeModified: no node for nodeId ${params.nodeId}`,
      );
      return;
    }
    const { _cdpNode: cdpNode, _docNode: docNode } = node;
    const attrIndex = cdpNode.attributes.indexOf(params.name);
    if (attrIndex !== -1) {
      cdpNode.attributes[attrIndex + 1] = params.value;
    } else {
      cdpNode.attributes.push(params.name, params.value);
    }
    (docNode as Element).setAttribute(params.name, params.value);
  }

  protected onAttributeRemoved(params: { nodeId: number; name: string }) {
    const node = this.idToNode.get(params.nodeId);
    if (!node) {
      this.emitWarning(
        `onAttributeRemoved: no node for nodeId ${params.nodeId}`,
      );
      return;
    }
    const { _cdpNode: cdpNode, _docNode: docNode } = node;
    // .attributes should always there, the optional is because only Element has attributes
    const attrIndex = cdpNode.attributes.indexOf(params.name);
    if (attrIndex !== -1) {
      cdpNode.attributes.splice(attrIndex, 2);
    }
    (docNode as Element).removeAttribute(params.name);
  }

  protected onCharacterDataModified(params: {
    nodeId: number;
    characterData: string;
  }) {
    const node = this.idToNode.get(params.nodeId);
    if (!node) {
      this.emitWarning(
        `onCharacterDataModified: no node for nodeId ${params.nodeId}`,
      );
      return;
    }
    const { _cdpNode: cdpNode, _docNode: docNode } = node;
    cdpNode.nodeValue = params.characterData;
    docNode.nodeValue = params.characterData;
  }

  protected async onChildNodeInserted(params: {
    parentNodeId: number;
    previousNodeId: number;
    node: CDPNode;
  }): Promise<void> {
    const node = this.idToNode.get(params.parentNodeId);
    if (!node) {
      this.emitWarning(
        `onChildNodeInserted: no node for nodeId ${params.parentNodeId}`,
      );
      return;
    }
    const { _cdpNode: cdpNode, _docNode: docNode } = node;
    // Get cdpNode children if needed
    //
    // We always maintain full tree, so unlike devtool we request children here.
    // This is async but fine because descendants won't be updated during await.
    // Even if parent is removed, the update still succeed because it holds the reference.
    //
    // The node from insert event may or maynot have children initialized,
    // hoping not partially initialized (say only one level).
    //
    // Node with only a #text child (ex: h1) won't get response.
    // DevTool UI also expand the #text as the same level.
    // Seems childNodeInserted will handle this by selective providing children.
    // So here checking !node.children is good.
    const childCdpNode = params.node;
    if (
      childCdpNode.nodeType === CDPNodeType.ELEMENT_NODE &&
      childCdpNode.childNodeCount > 0 &&
      !childCdpNode.children
    ) {
      await this.getChildren(childCdpNode);
    }

    const childDocNode = this.buildNodeTree(childCdpNode);

    const prevIdx =
      params.previousNodeId === 0
        ? -1
        : findNodeIdx(cdpNode.children, params.previousNodeId);
    if (prevIdx !== null) {
      // insert cdpNode
      cdpNode.children.splice(prevIdx + 1, 0, params.node);

      // insert docNode
      const referenceNode = docNode.childNodes[prevIdx + 1] || null; // null for append
      docNode.insertBefore(childDocNode, referenceNode);
    } else {
      this.emitWarning(
        `onChildNodeInserted: no previous node for nodeId ${params.previousNodeId}`,
      );
    }
  }

  protected onChildNodeRemoved(params: {
    parentNodeId: number;
    nodeId: number;
  }) {
    const node = this.idToNode.get(params.parentNodeId);
    if (!node) {
      this.emitWarning(
        `onChildNodeRemoved: no node for nodeId ${params.parentNodeId}`,
      );
      return;
    }
    const { _cdpNode: parentCdpNode, _docNode: parentDocNode } = node;
    const idx = findNodeIdx(parentCdpNode.children, params.nodeId);
    if (idx !== null) {
      this.deleteMap(params.nodeId);
      parentCdpNode.children.splice(idx, 1);
      parentDocNode.removeChild(parentDocNode.childNodes[idx]);
    } else {
      this.emitWarning(
        `onChildNodeRemoved: no child node for nodeId ${params.nodeId}`,
      );
    }
  }

  protected async onDocumentUpdated(): Promise<void> {
    await this.initDOM();
  }

  protected registerDOMHandlers() {
    const syncHandlerMap = {
      "DOM.attributeModified": this.onAttributeModified,
      "DOM.attributeRemoved": this.onAttributeRemoved,
      "DOM.characterDataModified": this.onCharacterDataModified,
      "DOM.childNodeRemoved": this.onChildNodeRemoved,
    };
    for (const [event, handler] of Object.entries(syncHandlerMap)) {
      this.onCDP(event, (params) => {
        handler.call(this, params);
        this.emit(event, params); // Emit event here
      });
    }

    const asyncHandlerMap = {
      "DOM.childNodeInserted": this.onChildNodeInserted,
      "DOM.documentUpdated": this.onDocumentUpdated,
    };

    for (const [event, handler] of Object.entries(asyncHandlerMap)) {
      this.onCDP(event, async (params) => {
        await handler.call(this, params);
        this.emit(event, params);
      });
    }
  }

  protected async registerBinding() {
    // add binding for sync $0
    await this.sendCommand("Runtime.addBinding", {
      name: "__chrome_inspector_send_$0_xpath",
    });
    this.onCDP(
      "Runtime.bindingCalled",
      (params: { name: string; payload: string }) => {
        this.selectedNode = this.queryXPath(params.payload) || undefined;
      },
    );
  }

  protected async init(): Promise<void> {
    await this.sendCommand("DOM.enable");
    await this.sendCommand("CSS.enable");
    await this.sendCommand("Overlay.enable"); // somehow have to enable to use
    await this.sendCommand("Runtime.enable");
    this.registerDOMHandlers();
    await this.registerBinding();
  }

  protected async initDOM(): Promise<void> {
    this.idToNode.clear();
    const { root } = await this.sendCommand("DOM.getDocument", {
      depth: -1,
    });
    // Use depth: -1 is probably safe, as tested in
    // https://source.chromium.org/chromium/chromium/src/+/main:third_party/blink/web_tests/inspector-protocol/dom/dom-mutationEvents.js;l=62;drc=ef646bf22edb325602a0ad200f2f4382cf1b3e08
    // Use -1 because it handles refresh better.

    // await this.getChildren(root);
    this.buildNodeTree(root);
  }

  // mainly for checking node tracked
  // also useful for mapping manually requested NodeId to InspectorNode
  getNodeByNodeId(nodeId: number): InspectorNode | undefined {
    const node = this.idToNode.get(nodeId);
    return node;
  }

  // inspector-wise operations

  async setDevice(device: Device): Promise<void> {
    await this.sendCommand("Emulation.setDeviceMetricsOverride", device);
  }

  async hideHighlight(): Promise<void> {
    await this.sendCommand("Overlay.hideHighlight");
  }

  // node-wise operations

  // can only have one highlighted node at a time
  async highlightNode(node: InspectorNode): Promise<void> {
    if (!node.tracked) {
      throw new Error("Element not tracked by the inspector.");
    }

    await this.sendCommand("Overlay.highlightNode", {
      highlightConfig,
      nodeId: node._cdpNode.nodeId,
    });
  }

  async forcePseudoState(
    element: InspectorElement,
    pseudoClasses: string[],
  ): Promise<void> {
    if (!element.tracked) {
      throw new Error("Element not tracked by the inspector.");
    }

    await this.sendCommand("CSS.forcePseudoState", {
      nodeId: element._cdpNode.nodeId,
      forcedPseudoClasses: pseudoClasses,
    });
  }

  async getMatchedStyles(
    element: InspectorElement,
    options: MatchedStylesOptions = {},
  ): Promise<GetMatchedStylesForNodeResponse | ParsedCSS> {
    const { raw = false, parseOptions = {} } = options;

    if (!element.tracked) {
      throw new Error("Element not tracked by the inspector.");
    }

    const ret: GetMatchedStylesForNodeResponse = await this.sendCommand(
      "CSS.getMatchedStylesForNode",
      {
        nodeId: element._cdpNode.nodeId,
      },
    );

    return raw ? ret : parseGetMatchedStylesForNodeResponse(ret, parseOptions);
  }

  async getComputedStyle(
    element: InspectorElement,
    options: ComputedStyleOptions = {},
  ): Promise<Record<string, string> | GetComputedStyleForNodeResponse> {
    const { raw = false } = options;

    if (!element.tracked) {
      throw new Error("Element not tracked by the inspector.");
    }

    const ret: GetComputedStyleForNodeResponse = await this.sendCommand(
      "CSS.getComputedStyleForNode",
      {
        nodeId: element._cdpNode.nodeId,
      },
    );

    return raw
      ? ret
      : ret.computedStyle.reduce(
          (
            obj: Record<string, string>,
            item: { name: string; value: string },
          ) => {
            obj[item.name] = item.value;
            return obj;
          },
          {},
        );
  }
}
