"use strict";
/**
 * Track video pages and report watch events.
 */
function extractBvidFromUrl(url) {
    const match = url.match(/\/video\/(BV[a-zA-Z0-9]+)/);
    return match ? match[1] : null;
}
function detectVideoElement() {
    return document.querySelector("video");
}
function sendWatchProgress(event) {
    console.log("[Tracker] Send watch progress", event);
    try {
        if (typeof chrome === "undefined" || typeof chrome.runtime?.sendMessage !== "function") {
            return;
        }
        chrome.runtime.sendMessage({ type: "watch_progress", payload: event });
    }
    catch (error) {
        console.warn("[Tracker] Send watch progress failed", error);
    }
}
function extractVideoMeta() {
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
    let upMid = undefined;
    const win = window;
    const stateMid = win.__INITIAL_STATE__?.videoData?.owner?.mid;
    if (typeof stateMid === "number") {
        upMid = stateMid;
    }
    else {
        const upLink = document.querySelector('a[href*="space.bilibili.com"]');
        const match = upLink?.href?.match(/space\.bilibili\.com\/(\d+)/);
        if (match) {
            upMid = Number(match[1]);
        }
    }
    const tags = new Set();
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
function trackVideoPlayback(video, bvid, sendFn) {
    let lastTime = video.currentTime;
    let accumulated = 0;
    let lastSentAt = Date.now();
    let cachedMeta = null;
    const refreshMeta = () => {
        cachedMeta = extractVideoMeta();
    };
    const flush = (reason) => {
        if (accumulated < 1) {
            return;
        }
        if (!cachedMeta || !cachedMeta.title) {
            refreshMeta();
        }
        const meta = cachedMeta ?? extractVideoMeta();
        const event = {
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
function initTracker() {
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
