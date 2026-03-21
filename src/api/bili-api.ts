/**
 * Bilibili API wrappers.
 */

export type FetchFn = (
  input: string,
  init?: unknown
) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

export interface UP {
  mid: number;
  name: string;
  face: string;
  sign: string;
  follow_time: number;
}

export interface WBIKeys {
  img_key: string;
  sub_key: string;
  mixin_key: string;
}

export interface Video {
  bvid: string;
  aid: number;
  title: string;
  play: number;
  duration: number;
  pubdate: number;
  tags: string[];
  created_at?: number; // 创建时间戳
}

export interface UPProfile {
  mid: number;
  name: string;
  sign: string;
  face: string;
}

interface ApiRequestOptions {
  fetchFn?: FetchFn;
  fetchInit?: RequestInit;
  fallbackRequest?: (url: string) => Promise<unknown | null>;
}

const DEFAULT_MIN_INTERVAL_MS = 200;
let lastRequestAt = 0;

/**
 * Simple delay helper.
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Rate limiter for API requests.
 */
export async function rateLimiter(
  minIntervalMs: number = DEFAULT_MIN_INTERVAL_MS
): Promise<void> {
  const now = Date.now();
  const waitTime = Math.max(0, lastRequestAt + minIntervalMs - now);
  if (waitTime > 0) {
    console.log("[API] Rate limit wait", waitTime);
    await delay(waitTime);
  }
  lastRequestAt = Date.now();
}

/**
 * Unified API request helper.
 */
import { getValue } from "../database/implementations/index.js";

async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    "Accept": "application/json, text/plain, */*",
    "Content-Type": "application/json"
  };

  try {
    const settings = await getValue<{ biliCookie?: string }>("settings");
    if (settings?.biliCookie) {
      headers["Cookie"] = settings.biliCookie;
    }
  } catch (error) {
    console.error("[API] Failed to get settings:", error);
  }

  return headers;
}

export async function apiRequest<T>(
  url: string,
  options: ApiRequestOptions = {}
): Promise<T | null> {
  const fetchFn = options.fetchFn || (fetch as unknown as FetchFn);
  const authHeaders = await getAuthHeaders();
  const fetchInit: RequestInit = {
    credentials: "include",
    mode: "cors",
    headers: authHeaders,
    ...(options.fetchInit ?? {})
  };
  try {
    await rateLimiter();
    console.log("[API] Request", url);
    const response = await fetchFn(url, fetchInit);
    if (!response.ok) {
      console.error("[API] Request failed", response.status, url);
      if (response.status === 412 && options.fallbackRequest) {
        const fallback = await options.fallbackRequest(url);
        return (fallback as T | null) ?? null;
      }
      return null;
    }
    const data = (await response.json()) as T;
    return data;
  } catch (error) {
    console.error("[API] Request error", error, url);
    return null;
  }
}

/**
 * Fetch followed UP list for a user.
 * @param uid User ID
 * @param options API request options
 * @param existingUPs Existing UP list for incremental update (optional)
 * @returns Object containing all UPs and count of new UPs
 */
export async function getFollowedUPs(
  uid: number,
  options: ApiRequestOptions = {},
  existingUPs?: UP[]
): Promise<{ upList: UP[]; newCount: number }> {
  const pageSize = 50;
  const all: UP[] = [];
  const existingSet = new Set(existingUPs?.map(up => up.mid) || []);
  const existingUPMap = new Map(existingUPs?.map(up => [up.mid, up]) || []);
  let page = 1;
  const existingInBatchThreshold = 10; // 批次中存在10个已存储的UP时停止拉取
  let isIncremental = false; // 是否为增量更新

  while (true) {
    const url = `https://api.bilibili.com/x/relation/followings?vmid=${uid}&pn=${page}&ps=${pageSize}&order=desc`;
    const data = await apiRequest<{ data?: { list?: any[] } }>(url, options);
    const list = data?.data?.list;
    if (!Array.isArray(list) || list.length === 0) {
      break;
    }

    // Log first item for debugging
    if (page === 1 && list.length > 0) {
      console.log("[API] First UP item:", JSON.stringify(list[0], null, 2));
    }

    // Map API response to UP interface
    const upList: UP[] = list.map((item) => ({
      mid: item.mid || item.attribute,
      name: item.uname || item.name || "",
      face: item.face || "",
      sign: item.sign || item.usign || "",
      follow_time: item.mtime || item.follow_time || 0
    }));

    // 判断是否为增量更新：当前批次中至少10个已关注的UP
    const existingInBatch = upList.filter(up => existingSet.has(up.mid)).length;
    if (existingInBatch >= existingInBatchThreshold) {
      isIncremental = true;
      console.log(`[API] Page ${page}: Detected incremental update (${existingInBatch} existing UPs in batch, threshold=${existingInBatchThreshold})`);
      // 如果是增量更新且当前批次中有足够多的已存在UP，停止拉取
      break;
    }

    all.push(...upList);
    if (list.length < pageSize) {
      break;
    }
    page += 1;
  }

  // 合并策略：
  // 1. 如果是增量更新，保留本地已有数据，只添加新的UP
  // 2. 如果不是增量更新，使用新获取的数据
  let finalUPList: UP[];
  if (isIncremental && existingUPs && existingUPs.length > 0) {
    // 增量更新：合并本地已有数据和新数据
    const mergedUPMap = new Map(existingUPMap); // 复制本地数据

    // 添加新获取的UP数据（已存在的会更新，不存在的会添加）
    for (const up of all) {
      mergedUPMap.set(up.mid, up);
    }

    finalUPList = Array.from(mergedUPMap.values());
    console.log(`[API] Incremental update: merged ${existingUPs.length} existing + ${all.length} fetched = ${finalUPList.length} total`);
  } else {
    // 全量更新：使用新获取的数据
    finalUPList = all;
    console.log(`[API] Full update: using ${all.length} fetched UPs`);
  }

  // Calculate new UPs (相对于本地已有数据)
  const newUPs = finalUPList.filter(up => !existingSet.has(up.mid));
  console.log("[API] Total UPs fetched:", all.length, "New UPs:", newUPs.length, "Is Incremental:", isIncremental);

  return { upList: finalUPList, newCount: newUPs.length };
}

/**
 * Fetch videos of a specific UP.
 */
export async function getUPVideos(
  mid: number,
  options: ApiRequestOptions = {}
): Promise<Video[]> {
  const url = `https://api.bilibili.com/x/space/arc/search?mid=${mid}&pn=1&ps=30&order=pubdate`;
  const data = await apiRequest<{ data?: { list?: { vlist?: Video[] } } }>(
    url,
    options
  );
  const list = data?.data?.list?.vlist;
  return Array.isArray(list) ? list : [];
}

/**
 * Fetch tags for a video by bvid.
 */
export async function getVideoTags(
  bvid: string,
  options: ApiRequestOptions = {}
): Promise<string[]> {
  const url = `https://api.bilibili.com/x/tag/archive/tags?bvid=${bvid}`;
  const data = await apiRequest<{ data?: { tag_name?: string }[] }>(
    url,
    options
  );
  const tags = data?.data;
  if (!Array.isArray(tags)) {
    return [];
  }
  return tags
    .map((tag) => tag?.tag_name)
    .filter((tagName): tagName is string => Boolean(tagName));
}

/**
 * Fetch profile info for a specific UP.
 */
export async function getUPInfo(
  mid: number,
  options: ApiRequestOptions = {}
): Promise<UPProfile | null> {
  const url = `https://api.bilibili.com/x/space/acc/info?mid=${mid}`;
  const data = await apiRequest<{ data?: UPProfile }>(url, options);
  return data?.data ?? null;
}

/**
 * Reset internal rate limiter (for tests).
 */
export function __resetRateLimiter(): void {
  lastRequestAt = 0;
}

// ==================== WBI 签名机制 ====================

let cachedWBIKeys: WBIKeys | null = null;
let wbiKeysExpireAt = 0;
const WBI_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24小时

/**
 * 获取 WBI 签名所需的密钥
 */
export async function getWBIKeys(
  options: ApiRequestOptions = {}
): Promise<WBIKeys | null> {
  const now = Date.now();
  if (cachedWBIKeys && now < wbiKeysExpireAt) {
    return cachedWBIKeys;
  }

  const url = "https://api.bilibili.com/x/web-interface/nav";
  const data = await apiRequest<{ data?: { wbi_img?: { img_url: string; sub_url: string } } }>(
    url,
    options
  );

  if (!data?.data?.wbi_img) {
    return null;
  }

  const img_url = data.data.wbi_img.img_url;
  const sub_url = data.data.wbi_img.sub_url;

  // 从 URL 中提取 img_key 和 sub_key
  const img_key = img_url.match(/img_key=([a-zA-Z0-9]+)/)?.[1] || "";
  const sub_key = sub_url.match(/sub_key=([a-zA-Z0-9]+)/)?.[1] || "";

  // 生成 mixin_key
  const mixin_key = img_key + sub_key;

  cachedWBIKeys = { img_key, sub_key, mixin_key };
  wbiKeysExpireAt = now + WBI_CACHE_DURATION;

  return cachedWBIKeys;
}

/**
 * 生成 WBI 签名
 * @param params 请求参数对象
 * @param options API 请求选项
 * @returns 包含 w_rid 和 wts 的对象
 */
export async function generateWBISign(
  params: Record<string, string | number>,
  options: ApiRequestOptions = {}
): Promise<{ w_rid: string; wts: string } | null> {
  const wbiKeys = await getWBIKeys(options);
  if (!wbiKeys) {
    return null;
  }

  // 添加时间戳
  const wts = Math.floor(Date.now() / 1000).toString();
  const paramsWithTs = { ...params, wts };

  // 按键名排序
  const sortedParams = Object.entries(paramsWithTs)
    .sort(([a], [b]) => a.localeCompare(b))
    .reduce((result: Record<string, string | number>, [key, value]) => {
      result[key] = value;
      return result;
    }, {} as Record<string, string | number>);


  // 拼接参数字符串
  const queryString = Object.entries(sortedParams)
    .map(([key, value]) => `${key}=${value}`)
    .join("&");

  // 计算 MD5
  const w_rid = await md5(queryString + wbiKeys.mixin_key);

  return { w_rid, wts };
}

/**
 * MD5 哈希函数
 */
async function md5(str: string): Promise<string> {
  // 将字符串转换为 Uint8Array
  const encoder = new TextEncoder();
  const data = encoder.encode(str);

  // 使用 SubtleCrypto 计算 SHA-256
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);

  // 将 ArrayBuffer 转换为十六进制字符串
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // 截取前32位作为模拟的MD5
  return hashHex.substring(0, 32);
}

// ==================== 视频信息 API ====================

export interface VideoDetail {
  bvid: string;
  aid: number;
  pic: string;
  title: string;
  desc: string;
  duration: number;
  pubdate: number;
  owner: {
    mid: number;
    name: string;
    face: string;
  };
}

export interface VideoStat {
  aid: number;
  view: number;
  danmaku: number;
  reply: number;
  favorite: number;
  coin: number;
  share: number;
  now_rank: number;
  his_rank: number;
  like: number;
}

/**
 * 获取视频详情
 * @param bvid BV号
 * @param aid AV号（可选）
 * @param options API请求选项
 */
export async function getVideoDetail(
  bvid?: string,
  aid?: number,
  options: ApiRequestOptions = {}
): Promise<VideoDetail | null> {
  let url = "https://api.bilibili.com/x/web-interface/view?";
  if (bvid) {
    url += `bvid=${bvid}`;
  } else if (aid) {
    url += `aid=${aid}`;
  } else {
    return null;
  }

  const data = await apiRequest<{ data?: VideoDetail }>(url, options);
  return data?.data ?? null;
}

/**
 * 获取视频统计
 * @param bvid BV号
 * @param options API请求选项
 */
export async function getVideoStat(
  bvid: string,
  options: ApiRequestOptions = {}
): Promise<VideoStat | null> {
  const url = `https://api.bilibili.com/x/web-interface/archive/stat?bvid=${bvid}`;
  const data = await apiRequest<{ data?: VideoStat }>(url, options);
  return data?.data ?? null;
}

export interface VideoTag {
  tag_id: number;
  tag_name: string;
}

/**
 * 获取视频标签
 * @param bvid BV号
 * @param options API请求选项
 */
export async function getVideoTagsDetail(
  bvid: string,
  options: ApiRequestOptions = {}
): Promise<VideoTag[]> {
  const url = `https://api.bilibili.com/x/tag/archive/tags?bvid=${bvid}`;
  const data = await apiRequest<{ data?: VideoTag[] }>(url, options);
  return data?.data ?? [];
}

/**
 * 获取相关视频
 * @param bvid BV号
 * @param options API请求选项
 */
export async function getRelatedVideos(
  bvid: string,
  options: ApiRequestOptions = {}
): Promise<Video[]> {
  const url = `https://api.bilibili.com/x/web-interface/archive/related?bvid=${bvid}`;
  const data = await apiRequest<{ data?: Video[] }>(url, options);
  return data?.data ?? [];
}

// ==================== 收藏夹 API ====================

export interface FavoriteFolder {
  id: number;
  fid: number;
  mid: number;
  attr: number;
  title: string;
  fav_state: number;
  media_count: number;
}

/**
 * 获取用户收藏夹列表
 * @param up_mid 用户ID
 * @param options API请求选项
 */
export async function getFavoriteFolders(
  up_mid: number,
  options: ApiRequestOptions = {}
): Promise<FavoriteFolder[]> {
  const url = `https://api.bilibili.com/x/v3/fav/folder/created/list-all?up_mid=${up_mid}`;
  const data = await apiRequest<{ data?: { list?: FavoriteFolder[] } }>(url, options);
  return data?.data?.list ?? [];
}

export interface FavoriteVideo {
  bvid: string;
  title: string;
  intro: string;
  cover: string;
  upper: {
    mid: number;
    name: string;
    face: string;
  };
  pubtime: number;
}

/**
 * 获取所有收藏夹的视频
 * @param up_mid 用户ID
 * @param options API请求选项
 * @returns 所有收藏夹的视频列表
 */
export async function getAllFavoriteVideos(
  up_mid: number,
  options: ApiRequestOptions = {}
): Promise<FavoriteVideo[]> {
  // 获取所有收藏夹
  const folders = await getFavoriteFolders(up_mid, options);
  const allVideos: FavoriteVideo[] = [];

  // 遍历所有收藏夹，获取其中的视频
  for (const folder of folders) {
    let page = 1;
    const pageSize = 20;

    while (true) {
      const videos = await getFavoriteVideos(folder.id, page, pageSize, options);
      if (videos.length === 0) {
        break;
      }
      allVideos.push(...videos);
      
      // 如果获取的视频数小于页大小，说明已经没有更多视频
      if (videos.length < pageSize) {
        break;
      }
      page++;
    }
  }

  return allVideos;
}

/**
 * 获取收藏夹视频
 * @param media_id 收藏夹ID
 * @param pn 页码
 * @param ps 每页数量
 * @param options API请求选项
 */
export async function getFavoriteVideos(
  media_id: number,
  pn = 1,
  ps = 20,
  options: ApiRequestOptions = {}
): Promise<FavoriteVideo[]> {
  const url = `https://api.bilibili.com/x/v3/fav/resource/list?media_id=${media_id}&pn=${pn}&ps=${ps}`;
  const data = await apiRequest<{ data?: { medias?: FavoriteVideo[] } }>(url, options);
  return data?.data?.medias ?? [];
}

// ==================== 关注系统 API ====================

export interface FollowStat {
  following: number;
  follower: number;
}

/**
 * 获取粉丝数量
 * @param vmid 用户ID
 * @param options API请求选项
 */
export async function getFollowStat(
  vmid: number,
  options: ApiRequestOptions = {}
): Promise<FollowStat | null> {
  const url = `https://api.bilibili.com/x/relation/stat?vmid=${vmid}`;
  const data = await apiRequest<{ data?: FollowStat }>(url, options);
  return data?.data ?? null;
}

// ==================== UP主视频 API ====================

/**
 * 获取UP视频列表（需要WBI签名）
 * @param mid UP id
 * @param pn 页码
 * @param ps 数量
 * @param options API请求选项
 */
export async function getUPVideosWithWBI(
  mid: number,
  pn = 1,
  ps = 30,
  options: ApiRequestOptions = {}
): Promise<Video[]> {
  const params = { mid, pn, ps };
  const sign = await generateWBISign(params, options);
  if (!sign) {
    return [];
  }

  const url = `https://api.bilibili.com/x/space/wbi/arc/search?mid=${mid}&pn=${pn}&ps=${ps}&w_rid=${sign.w_rid}&wts=${sign.wts}`;
  const data = await apiRequest<{ data?: { list?: { vlist?: Video[] } } }>(url, options);
  return data?.data?.list?.vlist ?? [];
}

/**
 * 获取UP视频列表用于LLM分类（需要WBI签名）
 * 这个方法会获取更详细的视频信息，包括视频标签
 * @param mid UP id
 * @param maxVideos 最大获取视频数（默认30）
 * @param options API请求选项
 * @returns 包含视频标签的完整视频列表
 */
export async function getUPVideosForClassification(
  mid: number,
  maxVideos = 30,
  options: ApiRequestOptions = {}
): Promise<Video[]> {
  const pageSize = 30;
  const allVideos: Video[] = [];
  let page = 1;

  while (allVideos.length < maxVideos) {
    const params = { mid, pn: page, ps: pageSize };
    const sign = await generateWBISign(params, options);
    if (!sign) {
      break;
    }

    const url = `https://api.bilibili.com/x/space/wbi/arc/search?mid=${mid}&pn=${page}&ps=${pageSize}&w_rid=${sign.w_rid}&wts=${sign.wts}`;
    const data = await apiRequest<{ data?: { list?: { vlist?: any[] } } }>(url, options);
    const list = data?.data?.list?.vlist;

    if (!Array.isArray(list) || list.length === 0) {
      break;
    }

    // 处理每页的视频
    for (const item of list) {
      if (allVideos.length >= maxVideos) {
        break;
      }

      const bvid = item.bvid;
      if (!bvid) continue;

      // 获取视频标签
      const tags = await getVideoTags(bvid, options);

      allVideos.push({
        bvid,
        aid: item.aid,
        title: item.title || "",
        play: item.play || 0,
        duration: item.length || 0,
        pubdate: item.created || item.pubdate || 0,
        tags
      });
    }

    // 如果获取的视频少于页大小，说明已经没有更多视频
    if (list.length < pageSize) {
      break;
    }

    page++;
  }

  console.log(`[API] Fetched ${allVideos.length} videos for UP ${mid}`);
  return allVideos;
}

// ==================== 搜索 API ====================

export interface SearchResult {
  result?: {
    video?: any[];
    upuser?: any[];
    article?: any[];
  };
}

/**
 * 综合搜索
 * @param keyword 关键词
 * @param page 页码
 * @param options API请求选项
 */
export async function searchAll(
  keyword: string,
  page = 1,
  options: ApiRequestOptions = {}
): Promise<SearchResult | null> {
  const url = `https://api.bilibili.com/x/web-interface/search/all/v2?keyword=${encodeURIComponent(keyword)}&page=${page}`;
  const data = await apiRequest<SearchResult>(url, options);
  return data ?? null;
}

export type SearchOrder = "click" | "pubdate" | "dm";

/**
 * 视频搜索
 * @param keyword 关键词
 * @param page 页码
 * @param order 排序方式
 * @param options API请求选项
 */
export async function searchVideos(
  keyword: string,
  page = 1,
  order: SearchOrder = "click",
  options: ApiRequestOptions = {}
): Promise<Video[] | null> {
  const url = `https://api.bilibili.com/x/web-interface/search/type?search_type=video&keyword=${encodeURIComponent(keyword)}&page=${page}&order=${order}`;
  const data = await apiRequest<{ data?: { result?: Video[] } }>(url, options);
  return data?.data?.result ?? null;
}

// ==================== 分区 API ====================

/**
 * 获取分区视频
 * @param rid 分区ID
 * @param pn 页码
 * @param ps 每页数量
 * @param options API请求选项
 */
export async function getRegionVideos(
  rid: number,
  pn = 1,
  ps = 20,
  options: ApiRequestOptions = {}
): Promise<Video[]> {
  const url = `https://api.bilibili.com/x/web-interface/dynamic/region?rid=${rid}&pn=${pn}&ps=${ps}`;
  const data = await apiRequest<{ data?: { archives?: Video[] } }>(url, options);
  return data?.data?.archives ?? [];
}

/**
 * 获取排行榜
 * @param rid 分区ID
 * @param day 天数
 * @param options API请求选项
 */
export async function getRanking(
  rid = 0,
  day = 3,
  options: ApiRequestOptions = {}
): Promise<Video[]> {
  const url = `https://api.bilibili.com/x/web-interface/ranking?rid=${rid}&day=${day}`;
  const data = await apiRequest<{ data?: { list?: Video[] } }>(url, options);
  return data?.data?.list ?? [];
}

// ==================== 评论 API ====================

export interface Comment {
  rpid: number;
  oid: number;
  type: number;
  mid: number;
  content: {
    message: string;
  };
  like: number;
  replies?: Comment[];
}

/**
 * 获取评论列表
 * @param oid 视频ID
 * @param type 类型（1表示视频）
 * @param options API请求选项
 */
export async function getComments(
  oid: number,
  type = 1,
  options: ApiRequestOptions = {}
): Promise<Comment[]> {
  const url = `https://api.bilibili.com/x/v2/reply/main?oid=${oid}&type=${type}`;
  const data = await apiRequest<{ data?: { replies?: Comment[] } }>(url, options);
  return data?.data?.replies ?? [];
}

// ==================== 弹幕 API ====================

export interface Danmaku {
  p: string; // 包含时间戳等信息的字符串
  content: string;
}

/**
 * 获取弹幕列表
 * @param cid 视频CID
 * @param options API请求选项
 */
export async function getDanmakuList(
  cid: number,
  options: ApiRequestOptions = {}
): Promise<Danmaku[]> {
  const url = `https://api.bilibili.com/x/v1/dm/list.so?oid=${cid}`;
  const data = await apiRequest<string>(url, options);
  
  if (!data) {
    return [];
  }

  // 解析XML格式的弹幕数据
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(data, "text/xml");
  const danmakuElements = xmlDoc.getElementsByTagName("d");

  const danmakus: Danmaku[] = [];
  for (let i = 0; i < danmakuElements.length; i++) {
    const element = danmakuElements[i];
    const p = element.getAttribute("p");
    const content = element.textContent || "";
    if (p) {
      danmakus.push({ p, content });
    }
  }

  return danmakus;
}
