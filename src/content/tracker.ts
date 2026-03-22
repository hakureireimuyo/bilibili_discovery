/**
 * Track video pages and report watch events.
 */

interface WatchProgress {
  bvid: string;
  title: string;
  upMid?: number;
  upName?: string;
  upFace?: string;
  tags: string[];
  watchedSeconds: number;
  currentTime?: number;
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

function extractMidFromSpaceLink(link: string | null | undefined): number | undefined {
  if (!link) {
    return undefined;
  }
  const match = link.match(/space\.bilibili\.com\/(\d+)/);
  if (!match) {
    return undefined;
  }
  const mid = Number(match[1]);
  return Number.isFinite(mid) && mid > 0 ? mid : undefined;
}

// 通用的发送消息函数
function sendMessage(type: string, event: WatchProgress, logPrefix: string): void {
  console.log(`[Tracker] ${logPrefix}`, event);
  try {
    if (typeof chrome === "undefined" || typeof chrome.runtime?.sendMessage !== "function") {
      return;
    }
    chrome.runtime.sendMessage({ type, payload: event }, (response) => {
      if (chrome.runtime.lastError) {
        const errorMsg = chrome.runtime.lastError.message || "";
        // 忽略扩展上下文失效的错误（扩展重新加载时的正常现象）
        if (errorMsg.includes("Extension context invalidated")) {
          console.log("[Tracker] Extension context invalidated, this is expected during reload");
        } else {
          console.warn(`[Tracker] ${logPrefix} failed:`, chrome.runtime.lastError);
        }
      }
    });
  } catch (error) {
    console.warn(`[Tracker] ${logPrefix} failed`, error);
  }
}

function sendWatchProgress(event: WatchProgress): void {
  sendMessage("watch_progress", event, "Send watch progress");
}

function sendInitializeVideoInfo(event: WatchProgress): void {
  sendMessage("initialize_video_info", event, "Send initialize video info");
}

function sendProcessUPInfo(event: WatchProgress): void {
  sendMessage("process_up_info", event, "Send process UP info");
}

function sendProcessVideoTags(event: WatchProgress): void {
  sendMessage("process_video_tags", event, "Send process video tags");
}

interface VideoMeta {
  title: string;
  upMid?: number;
  upName?: string;
  upFace?: string;
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
  // 直接从DOM中提取UP主ID
  const ownerSelectors = [
    ".up-name[href*='space.bilibili.com']",
    ".author-name[href*='space.bilibili.com']",
    ".staff-name[href*='space.bilibili.com']",
    ".up-detail-top a[href*='space.bilibili.com']",
    ".video-info-author a[href*='space.bilibili.com']"
  ];
  for (const selector of ownerSelectors) {
    const upLink = document.querySelector(selector) as HTMLAnchorElement | null;
    const mid = extractMidFromSpaceLink(upLink?.href);
    if (mid) {
      upMid = mid;
      break;
    }
  }

  const tags = new Set<string>();
  // 直接从DOM中提取标签
  const tagElements = document.querySelectorAll('a[href*="/tag/"], a[href*="search?keyword="], .tag-link, .tag-item');
  for (const el of Array.from(tagElements)) {
    const text = el.textContent?.trim();
    if (text) {
      tags.add(text);
    }
  }
  
  // 提取UP名称
  let upName: string | undefined = undefined;
  // 直接从页面中提取UP名称
  const upNameElement = document.querySelector('.up-name, .author-name, [class*="author"], [class*="up-name"], [class*="uploader"]');
  if (upNameElement) {
    upName = upNameElement.textContent?.trim();
  }
  
  // 提取UP头像
  let upFace: string | undefined = undefined;
  console.log("[Tracker] Extracting UP face from DOM");

  // 尝试多个选择器来查找头像元素
  const selectors = [
    '.bili-avatar', 
    'bili-avatar-img bili-avatar-face bili-avatar-img-radius'
  ];

  // 首先尝试使用XPath查找头像
  console.log("[Tracker] Trying to find avatar with XPath");
  try {
    const xpathResult = document.evaluate(
      '/html/body/div[2]/div[2]/div[2]/div/div[1]/div[1]/div[1]/div/a/div/img',
      document,
      null,
      XPathResult.FIRST_ORDERED_NODE_TYPE,
      null
    );
    const imgElement = xpathResult.singleNodeValue as HTMLImageElement | null;
    if (imgElement) {
      upFace = imgElement.src;
      console.log("[Tracker] UP face from XPath:", upFace);
      // 确保URL包含协议部分
      if (upFace && upFace.startsWith('//')) {
        upFace = 'https:' + upFace;
        console.log("[Tracker] UP face after adding protocol:", upFace);
      }
    } else {
      console.log("[Tracker] XPath did not find avatar element");
    }
  } catch (error) {
    console.error("[Tracker] Error finding avatar with XPath:", error);
  }

  // 如果XPath没有找到，尝试CSS选择器
  if (!upFace) {
    console.log("[Tracker] XPath failed, trying CSS selectors");
    for (const selector of selectors) {
      console.log("[Tracker] Trying selector:", selector);
      const element = document.querySelector(selector) as HTMLImageElement | null;
      if (element) {
        console.log("[Tracker] Found element with selector:", selector, "Tag:", element.tagName);

        // 如果找到的是img元素，直接获取src
        if (element.tagName === 'IMG') {
          upFace = element.src;
          console.log("[Tracker] UP face from img element:", upFace);
        } else {
          // 如果找到的是容器元素，查找内部的img
          const img = element.querySelector('img') as HTMLImageElement | null;
          if (img) {
            upFace = img.src;
            console.log("[Tracker] UP face from container img:", upFace);
          }
        }

        // 确保URL包含协议部分
        if (upFace && upFace.startsWith('//')) {
          upFace = 'https:' + upFace;
          console.log("[Tracker] UP face after adding protocol:", upFace);
        }

        // 如果找到了头像，就不再尝试其他选择器
        if (upFace) {
          break;
        }
      }
    }
  }

  console.log("[Tracker] Final UP face value:", upFace);

  return { title, upMid, upName, upFace, tags: Array.from(tags) };
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
  let isFlushing = false;

  const refreshMeta = () => {
    cachedMeta = extractVideoMeta();
  };

  let hasCompletedInitialMetadataSync = false;

  const flush = (reason: string) => {
    if (accumulated < 1) {
      return;
    }
    // 只在初始化时提取一次元数据，避免重复查询DOM
    const meta = cachedMeta ?? extractVideoMeta();

    // 如果元数据不完整（页面未加载完成），跳过本次发送
    if (!meta.title) {
      console.log("[Tracker] Meta incomplete, skipping flush:", meta);
      return;
    }

    const currentTimestamp = Date.now();
    // 使用两次触发时携带的时间戳数据来计算实际观看时长（毫秒转秒）
    const watchedSeconds = (currentTimestamp - lastSentAt) / 1000;

    const event: WatchProgress = {
      bvid,
      title: meta.title,
      upMid: meta.upMid,
      upName: meta.upName,
      upFace: meta.upFace,
      tags: meta.tags,
      watchedSeconds,
      currentTime: video.currentTime,
      duration: Number.isFinite(video.duration) ? video.duration : 0,
      timestamp: currentTimestamp
    };
    // console.log("[Tracker] Flush watch progress", reason, event);
    sendFn(event);
    // 重置累积时间和更新时间戳
    accumulated = 0;
    lastSentAt = currentTimestamp;
  };

  refreshMeta();
  
  // 初始化视频信息、UP信息和标签（只执行一次）
  // 等待页面加载完成后再初始化
  const initializeWhenReady = () => {
    // 每次都重新获取元数据，确保获取到最新的视频信息
    refreshMeta();

    if (!cachedMeta || !cachedMeta.title) {
      console.log("[Tracker] Meta not ready, waiting...");
      setTimeout(initializeWhenReady, 3000);
      return;
    }

    const meta: VideoMeta = cachedMeta;

    const initEvent: WatchProgress = {
      bvid,
      title: meta.title,
      upMid: meta.upMid,
      upName: meta.upName,
      upFace: meta.upFace,
      tags: meta.tags,
      watchedSeconds: 0,
      currentTime: video.currentTime,
      duration: Number.isFinite(video.duration) ? video.duration : 0,
      timestamp: Date.now()
    };
    
    // 初始化视频信息
    sendInitializeVideoInfo(initEvent);
    
    // 处理UP信息
    if (meta.upMid) {
      sendProcessUPInfo(initEvent);
    }
    
    // 处理视频标签
    if (meta.tags && meta.tags.length > 0) {
      sendProcessVideoTags(initEvent);
    }
    hasCompletedInitialMetadataSync = true;
  };

  // 开始初始化流程
  setTimeout(() => {
    if (!hasCompletedInitialMetadataSync) {
      initializeWhenReady();
    }
  }, 10000);

  // 监听URL变化，当URL中的bvid改变时重新初始化
  let lastBvid = bvid;
  const checkUrlChange = () => {
    const currentBvid = extractBvidFromUrl(window.location.href);
    if (currentBvid && currentBvid !== lastBvid) {
      console.log("[Tracker] BVID changed, reinitializing...");
      console.log("[Tracker] Old BVID:", lastBvid);
      console.log("[Tracker] New BVID:", currentBvid);
      lastBvid = currentBvid;

      // 重置缓存和状态
      cachedMeta = null;
      accumulated = 0;
      lastSentAt = Date.now();

      // 更新bvid
      bvid = currentBvid;

      // 等待页面加载新的内容
      console.log("[Tracker] Waiting for page to load new content...");
      setTimeout(() => {
        console.log("[Tracker] Page should have loaded new content, reinitializing...");
        refreshMeta();
        hasCompletedInitialMetadataSync = false;
        initializeWhenReady();
      }, 3000); // 等待3秒
    }
  };

  // 定期检查URL变化
  setInterval(checkUrlChange, 4000);

  video.addEventListener("timeupdate", () => {
    if (video.seeking) {
      lastTime = video.currentTime;
      return;
    }
    if (!video.paused) {
      const now = Date.now();
      // 计算实际观看时长（毫秒转秒）
      const watchedSeconds = (now - lastSentAt) / 1000;
      // 将实际观看时长累加到 accumulated
      accumulated = watchedSeconds;
      
      const delta = video.currentTime - lastTime;
      if (delta > 0 && delta < 5) {
        lastTime = video.currentTime;
      }
      // 只有当实际观看时长大于7秒时才发送进度更新
      if (watchedSeconds > 7) {
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
    console.log("[Tracker] Video element not found, retrying...");
    // 如果视频元素未找到，延迟重试
    setTimeout(() => {
      console.log("[Tracker] Retrying video element detection...");
      const retryVideo = detectVideoElement();
      if (retryVideo) {
        console.log("[Tracker] Video element found on retry");
        trackVideoPlayback(retryVideo, bvid, sendWatchProgress);
      } else {
        console.log("[Tracker] Video element still not found, will try again later");
        // 继续尝试
        setTimeout(() => initTracker(), 2000);
      }
    }, 1000);
    return;
  }
  trackVideoPlayback(video, bvid, sendWatchProgress);
}

// 确保页面完全加载后再初始化
function safeInitTracker() {
  try {
    if (typeof window !== "undefined" && typeof document !== "undefined") {
      initTracker();
    }
  } catch (error) {
    console.error("[Tracker] Error during initialization:", error);
    // 如果初始化出错，延迟重试
    setTimeout(safeInitTracker, 2000);
  }
}

// 使用多种方式确保初始化
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", safeInitTracker);
} else {
  safeInitTracker();
}

// 移除 window.load 事件监听器，避免重复初始化
// window.addEventListener("load", () => {
//   console.log("[Tracker] Page fully loaded, checking tracker...");
//   safeInitTracker();
// });
