import { ID, Timestamp } from "./base.js";

export interface UP {
  mid: number;
  name: string;
  face: string;
  face_data?: string;
  sign: string;
  follow_time: number;
  is_followed: boolean;
}

export interface AppVideo {
  bvid: string;
  aid: number;
  title: string;
  play: number;
  duration: number;
  pubdate: number;
  tags: string[];
  created_at?: number;
}

export interface UPCache {
  upList: UP[];
  lastUpdate: number;
}

export interface UPFaceDataCacheEntry {
  mid: number;
  face_data: string;
  lastUpdate: number;
}

export interface VideoCacheEntry {
  videos: AppVideo[];
  lastUpdate: number;
}

export interface UserInterest {
  tag: string;
  score: number;
}

export type InterestProfile = Record<string, UserInterest>;

export interface AppTag {
  id: ID;
  name: string;
  created_at: Timestamp;
  editable: boolean;
  count: number;
}

export type TagLibrary = Record<string, AppTag>;

export interface UPTagWeight {
  tag_id: ID;
  weight: number;
  editable?: boolean;
}

export interface UPTagWeights {
  mid: number;
  tags: UPTagWeight[];
  lastUpdate: Timestamp;
}

export interface UPTagCount {
  tag: ID;
  count: number;
  editable?: boolean;
}

export type UPTagCache = Record<string, { tags: UPTagCount[]; lastUpdate: Timestamp }>;

export interface AppCategory {
  id: ID;
  name: string;
  tag_ids: ID[];
  created_at: Timestamp;
}

export type CategoryLibrary = Record<string, AppCategory>;

export interface ClassifyStatus {
  lastUpdate: Timestamp;
}

export interface AppSettings {
  cacheHours: number;
  userId: number | null;
  apiBaseUrl: string;
  apiModel: string;
  apiKey: string;
  classifyMethod: "api" | "page";
  biliCookie: string;
}
