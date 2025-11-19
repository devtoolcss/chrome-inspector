// version independent types for CDP data
export type GetMatchedStylesForNodeResponse = {
  inlineStyle?: any;
  attributesStyle?: any;
  matchedCSSRules?: any[];
  pseudoElements?: any[];
  inherited?: any[];
  inheritedPseudoElements?: any[];
  cssKeyframesRules?: any[];
  cssPositionTryRules?: any[];
  activePositionFallbackIndex?: number;
  cssPropertyRules?: any[];
  cssPropertyRegistrations?: any[];
  cssFontPaletteValuesRule?: any;
  parentLayoutNodeId?: number;
  cssFunctionRules?: any[];
  [key: string]: any; // Allow any other properties
};

export type GetComputedStyleForNodeResponse = {
  computedStyle: { name: string; value: string }[];
  extraFields: Object;
};

export type CDPNode = {
  nodeId: number;
  nodeType: number;
  localName: string;
  attributes?: string[];
  childNodeCount?: number;
  children?: CDPNode[];
  [key: string]: any; // Allow any other properties
};

export type Device = {
  width: number;
  height: number;
  deviceScaleFactor: number;
  mobile: boolean;
};
