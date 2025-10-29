import { Inspector } from "./Inspector.js";
import type { CDPNode } from "./types.js";

export class InspectorNode {
  protected static nodeMap = new WeakMap<Node, InspectorNode>();

  readonly _docNode: Node;
  readonly _cdpNode: CDPNode;
  protected inspector: Inspector;
  protected objectId?: string | null;

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
    const node = this.inspector.getNodeById(this._cdpNode.nodeId);
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
}

export class InspectorElement extends InspectorNode {
  get element(): Element {
    return this._docNode as Element;
  }

  static get(element: Element): InspectorElement {
    const cached = InspectorElement.nodeMap.get(element);
    if (!cached) {
      throw Error("InspectorNode not found");
    }
    return cached as InspectorElement;
  }

  constructor(element: Element, cdpNode: CDPNode, inspector: Inspector) {
    super(element, cdpNode, inspector);
  }

  get tagName() {
    return this.element.tagName;
  }

  get id() {
    return this.element.id;
  }

  get className() {
    return this.element.className;
  }

  get children(): InspectorElement[] {
    return Array.from(this.element.children).map(InspectorElement.get);
  }

  get attributes(): NamedNodeMap {
    return this.element.attributes;
  }

  get classList(): DOMTokenList {
    return this.element.classList;
  }

  querySelector(selector: string): InspectorElement | null {
    const el = this.element.querySelector(selector);
    return el ? InspectorElement.get(el) : null;
  }

  querySelectorAll(selector: string): InspectorElement[] {
    return Array.from(this.element.querySelectorAll(selector)).map(
      InspectorElement.get,
    );
  }

  get textContent(): string | null {
    return this.element.textContent;
  }

  get innerHTML(): string {
    return this.element.innerHTML;
  }

  get outerHTML(): string {
    return this.element.outerHTML;
  }

  get parentNode(): InspectorNode | null {
    const parent = this.element.parentNode;
    if (!parent) return null;
    return parent instanceof Element
      ? InspectorElement.get(parent)
      : InspectorNode.get(parent);
  }

  get parentElement(): InspectorElement | null {
    return this.element.parentElement
      ? InspectorElement.get(this.element.parentElement)
      : null;
  }

  get nextSibling(): InspectorNode | null {
    const next = this.element.nextSibling;
    if (!next) return null;
    return next instanceof Element
      ? InspectorElement.get(next)
      : InspectorNode.get(next);
  }

  get nextElementSibling(): InspectorElement | null {
    return this.element.nextElementSibling
      ? InspectorElement.get(this.element.nextElementSibling)
      : null;
  }

  get previousSibling(): InspectorNode | null {
    const prev = this.element.previousSibling;
    if (!prev) return null;
    return prev instanceof Element
      ? InspectorElement.get(prev)
      : InspectorNode.get(prev);
  }

  get previousElementSibling(): InspectorElement | null {
    return this.element.previousElementSibling
      ? InspectorElement.get(this.element.previousElementSibling)
      : null;
  }

  get childNodes(): InspectorNode[] {
    return Array.from(this.element.childNodes).map((child) =>
      child instanceof Element
        ? InspectorElement.get(child)
        : InspectorNode.get(child),
    );
  }

  get firstChild(): InspectorNode | null {
    const first = this.element.firstChild;
    if (!first) return null;
    return first instanceof Element
      ? InspectorElement.get(first)
      : InspectorNode.get(first);
  }

  get lastChild(): InspectorNode | null {
    const last = this.element.lastChild;
    if (!last) return null;
    return last instanceof Element
      ? InspectorElement.get(last)
      : InspectorNode.get(last);
  }

  getAttribute(name: string) {
    return this.element.getAttribute(name);
  }

  matches(selector: string): boolean {
    return this.element.matches(selector);
  }

  closest(selector: string): InspectorElement | null {
    const el = this.element.closest(selector);
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
}
