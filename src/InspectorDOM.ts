import type {
  Inspector,
  MatchedStylesOptions,
  ComputedStyleOptions,
} from "./Inspector.js";
import type { ParsedCSS } from "@devtoolcss/parser";
import type {
  GetMatchedStylesForNodeResponse,
  GetComputedStyleForNodeResponse,
  CDPNode,
} from "./types.js";

export class InspectorNode {
  protected static nodeMap = new WeakMap<Node, InspectorNode>();

  readonly _docNode: Node;
  readonly _cdpNode: CDPNode;
  inspector: Inspector;
  objectId?: string | null;

  // User has to be sure about whether the InspectorNode has been created or not
  static get(node: Node): InspectorNode {
    const cached = InspectorNode.nodeMap.get(node);
    if (!cached) {
      throw Error("InspectorNode not found");
    }
    return cached;
  }

  constructor(docNode: Node, cdpNode: CDPNode, inspector: Inspector) {
    this._docNode = docNode;
    this._cdpNode = cdpNode;
    this.inspector = inspector;
    InspectorNode.nodeMap.set(docNode, this);
  }

  get tracked(): boolean {
    // check if the node is still tracked by inspector
    const node = this.inspector.getNodeByNodeId(this._cdpNode.nodeId);
    return node === this;
  }

  protected async callFunctionOn(args: any[], functionDeclaration: string) {
    // always do live check first
    if (!this.tracked) {
      throw new Error("Node is not tracked in the inspector");
    }

    if (!this.objectId) {
      // Get the remote object ID for this node
      const { object } = await this.inspector.sendCommand("DOM.resolveNode", {
        nodeId: this._cdpNode.nodeId,
      });
      this.objectId = object.objectId;
    }

    const { result, exceptionDetails } = await this.inspector.sendCommand(
      "Runtime.callFunctionOn",
      {
        objectId: this.objectId,
        arguments: args.map((arg) => ({ value: arg })),
        functionDeclaration,
      },
    );
    if (exceptionDetails) {
      const errorMessage = `${
        exceptionDetails.text || "Runtime exception"
      } at line ${exceptionDetails.lineNumber}, column ${
        exceptionDetails.columnNumber
      } of ${functionDeclaration}\n with arguments ${JSON.stringify(args)}`;
      const error = new Error(errorMessage);
      error.name = "RuntimeException";
      throw error;
    }
    return result;
  }

  get nodeType() {
    return this._docNode.nodeType;
  }

  get nodeName() {
    return this._docNode.nodeName;
  }

  get nodeValue() {
    return this._docNode.nodeValue;
  }

  get textContent(): string | null {
    return this._docNode.textContent;
  }

  get parentNode(): InspectorNode | null {
    return this._docNode.parentNode
      ? InspectorNode.get(this._docNode.parentNode)
      : null;
  }

  get childNodes(): InspectorNode[] {
    return Array.from(this._docNode.childNodes).map(InspectorNode.get);
  }

  get firstChild(): InspectorNode | null {
    return this._docNode.firstChild
      ? InspectorNode.get(this._docNode.firstChild)
      : null;
  }

  get lastChild(): InspectorNode | null {
    return this._docNode.lastChild
      ? InspectorNode.get(this._docNode.lastChild)
      : null;
  }

  get nextSibling(): InspectorNode | null {
    return this._docNode.nextSibling
      ? InspectorNode.get(this._docNode.nextSibling)
      : null;
  }

  get previousSibling(): InspectorNode | null {
    return this._docNode.previousSibling
      ? InspectorNode.get(this._docNode.previousSibling)
      : null;
  }

  contains(other: InspectorNode): boolean {
    return this._docNode.contains(other._docNode);
  }

  // runtime methods (experimental, limited support)
  //
  // Current difficulties are:
  // 1. getters/setters cannot be async
  // 2. serialized arguments cannot be compared. Ex: .removeChild(child)
  //    needs the exact child object
  // 3. some returned values need extra handling (like Node)

  /**
   * @experimental
   */
  async remove(): Promise<void> {
    await this.callFunctionOn([], "function() { this.remove(); }");
  }

  // CDP extra

  /**
   * @experimental
   * To hide, use inspector.hideHighlight()
   */
  async highlight(): Promise<void> {
    await this.inspector.highlightNode(this);
  }
}

export class InspectorElement extends InspectorNode {
  declare readonly _docNode: Element;

  static get(element: Element): InspectorElement {
    const cached = InspectorElement.nodeMap.get(element);
    if (!cached) {
      throw Error("InspectorElement not found");
    }
    return cached as InspectorElement;
  }

  constructor(element: Element, cdpNode: CDPNode, inspector: Inspector) {
    super(element, cdpNode, inspector);
  }

  get tagName() {
    return this._docNode.tagName;
  }

  get id() {
    return this._docNode.id;
  }

  get className() {
    return this._docNode.className;
  }

  get children(): InspectorElement[] {
    return Array.from(this._docNode.children).map(InspectorElement.get);
  }

  get attributes(): NamedNodeMap {
    return this._docNode.attributes;
  }

  get classList(): DOMTokenList {
    return this._docNode.classList;
  }

  querySelector(selector: string): InspectorElement | null {
    const el = this._docNode.querySelector(selector);
    return el ? InspectorElement.get(el) : null;
  }

  querySelectorAll(selector: string): InspectorElement[] {
    return Array.from(this._docNode.querySelectorAll(selector)).map(
      InspectorElement.get,
    );
  }

  get textContent(): string | null {
    return this._docNode.textContent;
  }

  get innerHTML(): string {
    return this._docNode.innerHTML;
  }

  get outerHTML(): string {
    return this._docNode.outerHTML;
  }

  get parentNode(): InspectorNode | null {
    const parent = this._docNode.parentNode;
    if (!parent) return null;
    return parent instanceof Element
      ? InspectorElement.get(parent)
      : InspectorNode.get(parent);
  }

  get parentElement(): InspectorElement | null {
    return this._docNode.parentElement
      ? InspectorElement.get(this._docNode.parentElement)
      : null;
  }

  get nextSibling(): InspectorNode | null {
    const next = this._docNode.nextSibling;
    if (!next) return null;
    return next instanceof Element
      ? InspectorElement.get(next)
      : InspectorNode.get(next);
  }

  get nextElementSibling(): InspectorElement | null {
    return this._docNode.nextElementSibling
      ? InspectorElement.get(this._docNode.nextElementSibling)
      : null;
  }

  get previousSibling(): InspectorNode | null {
    const prev = this._docNode.previousSibling;
    if (!prev) return null;
    return prev instanceof Element
      ? InspectorElement.get(prev)
      : InspectorNode.get(prev);
  }

  get previousElementSibling(): InspectorElement | null {
    return this._docNode.previousElementSibling
      ? InspectorElement.get(this._docNode.previousElementSibling)
      : null;
  }

  get childNodes(): InspectorNode[] {
    return Array.from(this._docNode.childNodes).map((child) =>
      child instanceof Element
        ? InspectorElement.get(child)
        : InspectorNode.get(child),
    );
  }

  get firstChild(): InspectorNode | null {
    const first = this._docNode.firstChild;
    if (!first) return null;
    return first instanceof Element
      ? InspectorElement.get(first)
      : InspectorNode.get(first);
  }

  get lastChild(): InspectorNode | null {
    const last = this._docNode.lastChild;
    if (!last) return null;
    return last instanceof Element
      ? InspectorElement.get(last)
      : InspectorNode.get(last);
  }

  getAttribute(name: string) {
    return this._docNode.getAttribute(name);
  }

  matches(selector: string): boolean {
    return this._docNode.matches(selector);
  }

  closest(selector: string): InspectorElement | null {
    const el = this._docNode.closest(selector);
    return el ? InspectorElement.get(el) : null;
  }

  // runtime methods (experimental, limited support)

  /**
   * @experimental
   */
  async scrollIntoView(): Promise<void> {
    await this.callFunctionOn([], "function() { this.scrollIntoView(); }");
  }

  /**
   * @experimental
   */
  async click(): Promise<void> {
    await this.callFunctionOn([], "function() { this.click(); }");
  }

  // CDP extra

  /**
   * @experimental
   */
  async forcePseudoState(pseudoClasses: string[]): Promise<void> {
    await this.inspector.forcePseudoState(this, pseudoClasses);
  }

  /**
   * @experimental
   */
  async getMatchedStyles(
    options: MatchedStylesOptions & { raw: true },
  ): Promise<GetMatchedStylesForNodeResponse>;
  async getMatchedStyles(
    options?: MatchedStylesOptions & { raw?: false },
  ): Promise<ParsedCSS>;
  async getMatchedStyles(
    options: MatchedStylesOptions = {},
  ): Promise<GetMatchedStylesForNodeResponse | ParsedCSS> {
    return await this.inspector.getMatchedStyles(this, options as any); // FIXME
  }

  /**
   * @experimental
   */
  async getComputedStyle(
    options: ComputedStyleOptions & { raw: true },
  ): Promise<GetComputedStyleForNodeResponse>;
  async getComputedStyle(
    options?: ComputedStyleOptions & { raw?: false },
  ): Promise<Record<string, string>>;
  async getComputedStyle(
    options: ComputedStyleOptions = {},
  ): Promise<Record<string, string> | GetComputedStyleForNodeResponse> {
    return await this.inspector.getComputedStyle(this, options as any); // FIXME
  }
}

export class InspectorDocument extends InspectorNode {
  declare readonly _docNode: Document;

  static get(document: Document): InspectorDocument {
    const cached = InspectorDocument.nodeMap.get(document);
    if (!cached) {
      throw Error("InspectorDocument not found");
    }
    return cached as InspectorDocument;
  }

  constructor(document: Document, cdpNode: CDPNode, inspector: Inspector) {
    super(document, cdpNode, inspector);
  }

  protected nsResolver(prefix: string) {
    const ns = {
      svg: "http://www.w3.org/2000/svg",
      xhtml: "http://www.w3.org/1999/xhtml",
    };
    return ns[prefix] || null;
  }

  get body(): InspectorElement | null {
    return this._docNode.body ? InspectorElement.get(this._docNode.body) : null;
  }

  get head(): InspectorElement | null {
    return this._docNode.head ? InspectorElement.get(this._docNode.head) : null;
  }

  get documentElement(): InspectorElement | null {
    return this._docNode.documentElement
      ? InspectorElement.get(this._docNode.documentElement)
      : null;
  }

  querySelector(selector: string): InspectorElement | null {
    const el = this._docNode.querySelector(selector);
    return el ? InspectorElement.get(el) : null;
  }

  querySelectorAll(selector: string): InspectorElement[] {
    return Array.from(this._docNode.querySelectorAll(selector)).map(
      InspectorElement.get,
    );
  }

  getElementById(id: string): InspectorElement | null {
    const el = this._docNode.getElementById(id);
    return el ? InspectorElement.get(el) : null;
  }

  getElementsByClassName(className: string): InspectorElement[] {
    return Array.from(this._docNode.getElementsByClassName(className)).map(
      InspectorElement.get,
    );
  }

  getElementsByTagName(tagName: string): InspectorElement[] {
    return Array.from(this._docNode.getElementsByTagName(tagName)).map(
      InspectorElement.get,
    );
  }

  /**
   * @experimental
   */
  queryXPath(xpath: string): InspectorNode | null {
    const result = this._docNode.evaluate(
      xpath,
      this._docNode,
      this.nsResolver,
      9, //XPathResult.FIRST_ORDERED_NODE_TYPE
      null,
    );
    const node = result.singleNodeValue;
    return node ? InspectorNode.get(node) : null;
  }

  /**
   * @experimental
   */
  queryXPathAll(xpath: string): InspectorNode[] {
    const result = this._docNode.evaluate(
      xpath,
      this._docNode,
      this.nsResolver,
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

  /**
   * @deprecated Use of remove() on the document node is not supported.
   * To fix, have to distinguish Node and ChildNode, maybe in future major release.
   */
  async remove(): Promise<void> {
    throw new Error("Cannot remove the document node");
  }
}
