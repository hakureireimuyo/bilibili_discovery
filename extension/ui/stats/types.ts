/**
 * Stats page types.
 */

import type { Tag, Category, UPTagWeightsCache, TagLibrary } from "../../storage/storage.js";

export interface InterestProfile {
  [tag: string]: { tag: string; score: number };
}

export interface UPCache {
  upList: { mid: number; name: string; face: string }[];
}

export interface DragContext {
  tag: string;
  originUpMid?: number;
  categoryId?: string;
  dropped: boolean;
}
