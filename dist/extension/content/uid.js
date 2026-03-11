"use strict";
/**
 * Detect Bilibili user UID from page context.
 */
function extractUidFromWindow(win) {
    const mid = win.__INITIAL_STATE__?.user?.mid;
    return typeof mid === "number" && mid > 0 ? mid : null;
}
function postUid(uid) {
    chrome.runtime.sendMessage({ type: "detect_uid", payload: { uid } });
}
function injectPageProbe() {
    // Directly try to access __INITIAL_STATE__ without injecting script
    try {
        const win = window;
        const uid = win.__INITIAL_STATE__?.user?.mid;
        if (typeof uid === "number" && uid > 0) {
            window.postMessage({ source: "bde", type: "uid_detected", uid }, "*");
        }
    }
    catch (e) {
        console.warn("[UID] Failed to access __INITIAL_STATE__", e);
    }
}
function initUidDetector() {
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
        const data = event.data;
        if (data?.source === "bde" && data?.type === "uid_detected" && data.uid) {
            console.log("[UID] Detected user (injected)", data.uid);
            postUid(data.uid);
        }
    });
    injectPageProbe();
}
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    const payload = message;
    if (!payload || payload.type !== "bili_api_request" || !payload.url) {
        return;
    }
    fetch(payload.url, { credentials: "include" })
        .then((res) => res.json())
        .then((data) => sendResponse({ data }))
        .catch(() => sendResponse({ data: null }));
    return true;
});
if (typeof window !== "undefined") {
    initUidDetector();
}
