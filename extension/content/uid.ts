/**
 * Detect Bilibili user UID from page context.
 */

function extractUidFromWindow(
  win: Window & { __INITIAL_STATE__?: { user?: { mid?: number } } }
): number | null {
  const mid = win.__INITIAL_STATE__?.user?.mid;
  return typeof mid === "number" && mid > 0 ? mid : null;
}

function postUid(uid: number): void {
  if (typeof chrome !== "undefined" && chrome.runtime) {
    chrome.runtime.sendMessage(
      { type: "detect_uid", payload: { uid } },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error("[UID] Message send error:", chrome.runtime.lastError);
        }
      }
    );
  } else {
    console.log("[UID] Chrome runtime not available, skipping message send");
  }
}

function injectPageProbe(): void {
  // Directly try to access __INITIAL_STATE__ without injecting script
  try {
    const win = window as unknown as {
      __INITIAL_STATE__?: {
        user?: {
          mid?: number;
        };
      };
    };
    const uid = win.__INITIAL_STATE__?.user?.mid;
    if (typeof uid === "number" && uid > 0) {
      window.postMessage({ source: "bde", type: "uid_detected", uid }, "*");
    }
  } catch (e) {
    console.warn("[UID] Failed to access __INITIAL_STATE__", e);
  }
}

function initUidDetector(): void {
  if (typeof window === "undefined") {
    return;
  }
  const directUid = extractUidFromWindow(window);
  if (directUid) {
    console.log("[UID] Detected user (direct)", directUid);
    postUid(directUid);
    return;
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window) {
      return;
    }
    const data = event.data as { source?: string; type?: string; uid?: number };
    if (data?.source === "bde" && data?.type === "uid_detected" && data.uid) {
      console.log("[UID] Detected user (injected)", data.uid);
      postUid(data.uid);
    }
  });

  injectPageProbe();
}

if (typeof chrome !== "undefined" && chrome.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    const payload = message as { type?: string; url?: string };
    if (!payload || payload.type !== "bili_api_request" || !payload.url) {
      return;
    }
    fetch(payload.url, { credentials: "include" })
      .then((res) => res.json())
      .then((data) => sendResponse({ data }))
      .catch(() => sendResponse({ data: null }));
    return true;
  });
}

if (typeof window !== "undefined") {
  initUidDetector();
}
