/**
 * Track video pages and report watch events.
 */

interface WatchProgress {
  bvid: string;
  title: string;
  upMid?: number;
  tags: string[];
  watchedSeconds: number;
  duration: number;
  timestamp: number;
}

function extractBvidFromUrl(url: string): string | null {
  const match = url.match(/\/video\/(BV[a-zA-Z0-9]+)/);
  return match ? match[1] : null;
}

function detectVideoElement(): HTMLVideoElement | null {
  return document.querySelector("video");
}

function sendWatchProgress(event: WatchProgress): void {
  console.log("[Tracker] Send watch progress", event);
  try {
    if (typeof chrome === "undefined" || typeof chrome.runtime?.sendMessage !== "function") {
      return;
    }
    chrome.runtime.sendMessage({ type: "watch_progress", payload: event }, (response) => {
      if (chrome.runtime.lastError) {
        const errorMsg = chrome.runtime.lastError.message || "";
        // 忽略扩展上下文失效的错误（扩展重新加载时的正常现象）
        if (errorMsg.includes("Extension context invalidated")) {
          console.log("[Tracker] Extension context invalidated, this is expected during reload");
        } else {
          console.warn("[Tracker] Send watch progress failed:", chrome.runtime.lastError);
        }
      }
    });
  } catch (error) {
    console.warn("[Tracker] Send watch progress failed", error);
  }
}

interface VideoMeta {
  title: string;
  upMid?: number;
  tags: string[];
}

function extractVideoMeta(): VideoMeta {
  const titleSelectors = [
    "h1.video-title",
    "h1.title",
    ".video-title",
    "h1"
  ];
  let title = "";
  for (const selector of titleSelectors) {
    const el = document.querySelector(selector);
    const text = el?.textContent?.trim();
    if (text) {
      title = text;
      break;
    }
  }
  if (!title) {
    const docTitle = document.title || "";
    title = docTitle.split("_")[0].split("-")[0].trim();
  }

  let upMid: number | undefined = undefined;
  const win = window as unknown as {
    __INITIAL_STATE__?: { videoData?: { owner?: { mid?: number } }; tags?: Array<{ tag_name?: string }> };
  };
  const stateMid = win.__INITIAL_STATE__?.videoData?.owner?.mid;
  if (typeof stateMid === "number") {
    upMid = stateMid;
  } else {
    const upLink = document.querySelector('a[href*="space.bilibili.com"]') as HTMLAnchorElement | null;
    const match = upLink?.href?.match(/space\.bilibili\.com\/(\d+)/);
    if (match) {
      upMid = Number(match[1]);
    }
  }

  const tags = new Set<string>();
  for (const tag of win.__INITIAL_STATE__?.tags ?? []) {
    if (tag.tag_name) {
      tags.add(tag.tag_name);
    }
  }
  const tagElements = document.querySelectorAll('a[href*="/tag/"], a[href*="search?keyword="], .tag-link, .tag-item');
  for (const el of Array.from(tagElements)) {
    const text = el.textContent?.trim();
    if (text) {
      tags.add(text);
    }
  }

  return { title, upMid, tags: Array.from(tags) };
}

function trackVideoPlayback(
  video: HTMLVideoElement,
  bvid: string,
  sendFn: (event: WatchProgress) => void
): void {
  let lastTime = video.currentTime;
  let accumulated = 0;
  let lastSentAt = Date.now();
  let cachedMeta: VideoMeta | null = null;

  const refreshMeta = () => {
    cachedMeta = extractVideoMeta();
  };

  const flush = (reason: string) => {
    if (accumulated < 1) {
      return;
    }
    if (!cachedMeta || !cachedMeta.title) {
      refreshMeta();
    }
    const meta = cachedMeta ?? extractVideoMeta();
    const event: WatchProgress = {
      bvid,
      title: meta.title,
      upMid: meta.upMid,
      tags: meta.tags,
      watchedSeconds: accumulated,
      duration: Number.isFinite(video.duration) ? video.duration : 0,
      timestamp: Date.now()
    };
    console.log("[Tracker] Flush watch progress", reason, event);
    sendFn(event);
    accumulated = 0;
    lastSentAt = Date.now();
  };

  refreshMeta();

  video.addEventListener("timeupdate", () => {
    if (video.seeking) {
      lastTime = video.currentTime;
      return;
    }
    if (!video.paused) {
      const delta = video.currentTime - lastTime;
      if (delta > 0 && delta < 5) {
        accumulated += delta;
      }
      lastTime = video.currentTime;
      const now = Date.now();
      if (accumulated >= 5 || now - lastSentAt >= 15000) {
        flush("tick");
      }
    }
  });

  video.addEventListener("pause", () => flush("pause"));
  video.addEventListener("ended", () => flush("ended"));
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      flush("hidden");
    }
  });
  window.addEventListener("beforeunload", () => flush("unload"));
}

function initTracker(): void {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return;
  }
  const bvid = extractBvidFromUrl(window.location.href);
  if (!bvid) {
    return;
  }
  console.log(`[Tracker] Video detected: ${bvid}`);
  const video = detectVideoElement();
  if (!video) {
    console.log("[Tracker] Video element not found");
    return;
  }
  trackVideoPlayback(video, bvid, sendWatchProgress);
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  initTracker();
}
