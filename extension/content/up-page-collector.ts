/**
 * Collect UP profile and video information from UP homepage.
 */

interface UPPageData {
  mid: number;
  name: string;
  sign: string;
  face: string;
  videos: Array<{
    bvid: string;
    title: string;
    play: number;
    duration: number;
  }>;
  pageText: string; // 所有页面文字内容
}

interface UPPageResponse {
  ok: boolean;
  data?: UPPageData;
}

function extractMidFromUrl(url: string): number | null {
  const match = url.match(/space\.bilibili\.com\/(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

function extractUPDataFromPage(): UPPageData | null {
  // Try to extract from window.__INITIAL_STATE__
  const win = window as unknown as {
    __INITIAL_STATE__?: {
      space?: {
        mid?: number;
        name?: string;
        sign?: string;
        face?: string;
        videoList?: {
          list?: {
            vlist?: Array<{
              bvid: string;
              title: string;
              play: number;
              length: string;
            }>;
          };
        };
      };
    };
  };

  console.log("[UPPageCollector] Checking __INITIAL_STATE__:", !!win.__INITIAL_STATE__);
  if (win.__INITIAL_STATE__) {
    console.log("[UPPageCollector] __INITIAL_STATE__ keys:", Object.keys(win.__INITIAL_STATE__));
    console.log("[UPPageCollector] __INITIAL_STATE__.space:", !!win.__INITIAL_STATE__.space);
    if (win.__INITIAL_STATE__.space) {
      console.log("[UPPageCollector] space keys:", Object.keys(win.__INITIAL_STATE__.space));
    }
  }

  const space = win.__INITIAL_STATE__?.space;
  if (!space?.mid) {
    console.log("[UPPageCollector] No space.mid found");
    return null;
  }

  const videos = (space.videoList?.list?.vlist ?? []).slice(0, 10).map(v => ({
    bvid: v.bvid,
    title: v.title,
    play: v.play,
    duration: parseDuration(v.length)
  }));

  // Extract video titles from bili-video-card__title elements
  console.log("[UPPageCollector] Extracting video titles from page...");
  const titleElements = document.querySelectorAll('.bili-video-card__title');
  console.log("[UPPageCollector] Found", titleElements.length, "video title elements");
  
  const videoTitles: string[] = [];
  for (let i = 0; i < titleElements.length; i++) {
    const titleText = titleElements[i].textContent?.trim();
    if (titleText) {
      videoTitles.push(titleText);
    }
  }
  
  const pageText = videoTitles.join(" | ");
  console.log("[UPPageCollector] Extracted", videoTitles.length, "video titles");
  console.log("[UPPageCollector] Page text preview:", pageText.substring(0, 200));

  return {
    mid: space.mid,
    name: space.name ?? "",
    sign: space.sign ?? "",
    face: space.face ?? "",
    videos,
    pageText
  };
}

function extractUPDataFromDOM(): UPPageData | null {
  // Fallback: extract from DOM
  console.log("[UPPageCollector] Starting DOM extraction");
  console.log("[UPPageCollector] Current URL:", window.location.href);
  console.log("[UPPageCollector] Document ready state:", document.readyState);
  
  const midMatch = window.location.href.match(/space\.bilibili\.com\/(\d+)/);
  if (!midMatch) {
    console.log("[UPPageCollector] No mid found in URL");
    return null;
  }
  const mid = parseInt(midMatch[1], 10);
  console.log("[UPPageCollector] Extracted mid:", mid);
  
  // Try to get name from page title
  let name = "";
  const titleEl = document.querySelector('title');
  if (titleEl) {
    const titleText = titleEl.textContent?.trim() ?? "";
    console.log("[UPPageCollector] Page title:", titleText);
    // Extract name from title (format: "UP的个人空间 - 哔哩哔哩")
    const nameMatch = titleText.match(/^(.+)的个人空间/);
    if (nameMatch) {
      name = nameMatch[1];
    }
  }
  console.log("[UPPageCollector] name:", name);
  
  // Try to get sign
  let sign = "";
  const signEl = document.querySelector('.sign-content');
  if (!signEl) {
    // Try alternative selector
    const altSignEl = document.querySelector('.user-info .sign');
    if (altSignEl) {
      sign = altSignEl.textContent?.trim() ?? "";
    }
  } else {
    sign = signEl.textContent?.trim() ?? "";
  }
  console.log("[UPPageCollector] sign:", sign);
  
  // Try to get face
  let face = "";
  const faceEl = document.querySelector('.avatar img');
  if (!faceEl) {
    // Try alternative selector
    const altFaceEl = document.querySelector('.h-avatar img');
    if (altFaceEl instanceof HTMLImageElement) {
      face = altFaceEl.src;
    }
  } else if (faceEl instanceof HTMLImageElement) {
    face = faceEl.src;
  }
  console.log("[UPPageCollector] face:", face);
  
  // Try to get videos from the page
  const videoItems = document.querySelectorAll('.video-item');
  console.log("[UPPageCollector] videoItems count:", videoItems.length);
  const videos: Array<{
    bvid: string;
    title: string;
    play: number;
    duration: number;
  }> = [];
  
  for (let i = 0; i < Math.min(videoItems.length, 10); i++) {
    const item = videoItems[i];
    const linkEl = item.querySelector('a');
    const bvidMatch = linkEl?.getAttribute('href')?.match(/\/video\/(BV[\w]+)/);
    const bvid = bvidMatch ? bvidMatch[1] : "";
    const titleEl = item.querySelector('.title');
    const title = titleEl?.textContent?.trim() ?? "";
    const playEl = item.querySelector('.play-icon');
    const playText = playEl?.textContent?.trim() ?? "0";
    const play = parseFloat(playText.replace(/[^\d.]/g, "")) || 0;
    const durationEl = item.querySelector('.duration');
    const durationText = durationEl?.textContent?.trim() ?? "0:00";
    const duration = parseDuration(durationText);
    
    console.log("[UPPageCollector] Video", i, "bvid:", bvid, "title:", title);
    
    if (bvid && title) {
      videos.push({ bvid, title, play, duration });
    }
  }
  
  console.log("[UPPageCollector] Extracted videos count:", videos.length);
  
  // Extract video titles from bili-video-card__title elements
  console.log("[UPPageCollector] Extracting video titles from page...");
  const titleElements = document.querySelectorAll('.bili-video-card__title');
  console.log("[UPPageCollector] Found", titleElements.length, "video title elements");
  
  const videoTitles: string[] = [];
  for (let i = 0; i < titleElements.length; i++) {
    const titleText = titleElements[i].textContent?.trim();
    if (titleText) {
      videoTitles.push(titleText);
    }
  }
  
  const pageText = videoTitles.join(" | ");
  console.log("[UPPageCollector] Extracted", videoTitles.length, "video titles");
  console.log("[UPPageCollector] Page text preview:", pageText.substring(0, 200));
  
  // Accept data if we have at least name or videos
  if (!name && videos.length === 0 && videoTitles.length === 0) {
    console.log("[UPPageCollector] No name, videos or video titles found, returning null");
    return null;
  }
  
  console.log("[UPPageCollector] DOM extraction successful");
  return {
    mid,
    name,
    sign,
    face,
    videos,
    pageText
  };
}

function parseDuration(length: string): number {
  // Parse duration in format "MM:SS" or "HH:MM:SS"
  const parts = length.split(":").map(Number);
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  return 0;
}

function initPageCollector(): void {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return;
  }

  const mid = extractMidFromUrl(window.location.href);
  if (!mid) {
    console.log("[UPPageCollector] Not a UP page, skipping");
    return;
  }

  console.log("[UPPageCollector] UP page detected, mid:", mid);
  console.log("[UPPageCollector] Current URL:", window.location.href);

  // Wait for page to load
  const checkAndCollect = () => {
    console.log("[UPPageCollector] Attempting to collect data for mid:", mid);
    
    let data = extractUPDataFromPage();
    console.log("[UPPageCollector] Extract from __INITIAL_STATE__:", data ? "SUCCESS" : "FAILED");
    
    // Fallback to DOM extraction if __INITIAL_STATE__ is not available
    if (!data) {
      console.log("[UPPageCollector] Trying DOM extraction as fallback");
      data = extractUPDataFromDOM();
      console.log("[UPPageCollector] Extract from DOM:", data ? "SUCCESS" : "FAILED");
    }
    
    if (data) {
      console.log("[UPPageCollector] Data collected successfully:", {
        mid: data.mid,
        name: data.name,
        sign: data.sign,
        videoCount: data.videos.length
      });
      console.log("[UPPageCollector] Video samples:", data.videos.slice(0, 3).map(v => ({
        bvid: v.bvid,
        title: v.title
      })));
      
      chrome.runtime.sendMessage({
        type: "up_page_collected",
        payload: data
      }, (response) => {
        console.log("[UPPageCollector] Message sent to background, response:", response);
      });
    } else {
      // Check if UP is invalid by looking at page title and page content
      const pageTitle = document.title;
      const pageContent = document.body.innerText;
      
      // Check for invalid UP indicators
      const isInvalidUP = pageTitle.includes("啥都木有") || 
                         pageTitle.includes("UP不存在") || 
                         pageTitle.includes("账号已注销") ||
                         pageTitle.includes("账号已封禁") ||
                         pageTitle.startsWith("的个人空间-个人主页-哔哩哔哩视频") ||
                         pageContent.includes("啥都木有") ||
                         pageContent.includes("UP不存在") ||
                         pageContent.includes("账号已注销") ||
                         pageContent.includes("账号已封禁");
      
      if (isInvalidUP) {
        console.log("[UPPageCollector] UP appears to be invalid, sending invalid UP message");
        chrome.runtime.sendMessage({
          type: "up_page_collected",
          payload: {
            mid: mid,
            name: "",
            sign: "",
            videos: []
          }
        }, (response) => {
          console.log("[UPPageCollector] Invalid UP message sent to background, response:", response);
        });
      } else {
        console.log("[UPPageCollector] Data collection failed, retrying in 1 second...");
        // Retry after delay
        setTimeout(checkAndCollect, 1000);
      }
    }
  };

  // Initial attempt
  console.log("[UPPageCollector] Starting data collection in 2 seconds...");
  setTimeout(checkAndCollect, 2000);
}

if (typeof window !== "undefined") {
  initPageCollector();
}
