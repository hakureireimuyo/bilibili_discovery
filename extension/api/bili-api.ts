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

export interface Video {
  bvid: string;
  aid: number;
  title: string;
  play: number;
  duration: number;
  pubdate: number;
  tags: string[];
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
export async function apiRequest<T>(
  url: string,
  options: ApiRequestOptions = {}
): Promise<T | null> {
  const fetchFn = options.fetchFn || (fetch as unknown as FetchFn);
  const fetchInit: RequestInit = {
    credentials: "include",
    mode: "cors",
    headers: {
      Accept: "application/json, text/plain, */*"
    },
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
  let page = 1;
  let consecutiveAllExistCount = 0;
  const maxConsecutiveAllExist = 3; // 连续3页都全部存在则停止拉取

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

    // Check if all UPs in this page already exist
    const allExist = upList.every(up => existingSet.has(up.mid));
    if (allExist) {
      consecutiveAllExistCount++;
      console.log(`[API] Page ${page}: All ${upList.length} UPs already exist`);
      if (consecutiveAllExistCount >= maxConsecutiveAllExist) {
        console.log(`[API] Stopping after ${maxConsecutiveAllExist} consecutive pages with all existing UPs`);
        break;
      }
    } else {
      consecutiveAllExistCount = 0;
    }

    all.push(...upList);
    if (list.length < pageSize) {
      break;
    }
    page += 1;
  }

  // Calculate new UPs
  const newUPs = all.filter(up => !existingSet.has(up.mid));
  console.log("[API] Total UPs fetched:", all.length, "New UPs:", newUPs.length);

  return { upList: all, newCount: newUPs.length };
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
