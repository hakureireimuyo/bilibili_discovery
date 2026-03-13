/**
 * Track follow/unfollow events on Bilibili pages.
 */

import { getValue, setValue, loadUPList, saveUPList } from "../storage/storage.js";

interface UP {
  mid: number;
  name: string;
  face: string;
  sign: string;
  follow_time: number;
}

interface UPCache {
  upList: UP[];
  lastUpdate: number;
}

/**
 * 提取UP信息从页面
 */
function extractUPInfo(): { mid: number; name: string; face: string; sign: string } | null {
  try {
    const win = window as unknown as {
      __INITIAL_STATE__?: {
        upData?: {
          mid?: number;
          name?: string;
          face?: string;
          sign?: string;
        };
        videoData?: {
          owner?: {
            mid?: number;
            name?: string;
            face?: string;
          };
        };
      };
    };

    // 尝试从upData获取（UP主页）
    let upData = win.__INITIAL_STATE__?.upData;

    // 如果没有，尝试从videoData获取（视频页面）
    if (!upData || !upData.mid) {
      upData = win.__INITIAL_STATE__?.videoData?.owner;
    }

    if (!upData || !upData.mid) {
      return null;
    }

    return {
      mid: upData.mid,
      name: upData.name || "",
      face: upData.face || "",
      sign: upData.sign || ""
    };
  } catch (error) {
    console.error("[FollowTracker] Failed to extract UP info:", error);
    return null;
  }
}

/**
 * 检查关注按钮的状态
 */
function checkFollowButton(): void {
  const followBtn = document.querySelector(".follow-btn-inner") as HTMLElement | null;
  if (!followBtn) {
    console.log("[FollowTracker] Follow button not found, retrying...");
    // 如果没有找到按钮，延迟重试
    setTimeout(checkFollowButton, 2000);
    return;
  }

  const upInfo = extractUPInfo();
  if (!upInfo) {
    console.warn("[FollowTracker] Failed to extract UP info");
    return;
  }

  const isFollowed = followBtn.textContent?.trim() === "已关注";

  // 创建MutationObserver监听按钮文本变化
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === "childList" || mutation.type === "characterData") {
        const newIsFollowed = followBtn.textContent?.trim() === "已关注";

        // 如果状态发生变化
        if (newIsFollowed !== isFollowed) {
          console.log("[FollowTracker] Follow status changed:", {
            mid: upInfo.mid,
            name: upInfo.name,
            followed: newIsFollowed
          });

          // 发送消息到后台处理
          if (typeof chrome !== "undefined" && chrome.runtime) {
            chrome.runtime.sendMessage(
              {
                type: "follow_status_changed",
                payload: {
                  mid: upInfo.mid,
                  name: upInfo.name,
                  face: upInfo.face,
                  sign: upInfo.sign,
                  followed: newIsFollowed
                }
              },
              (response) => {
                // 处理可能的错误响应
                if (chrome.runtime.lastError) {
                  console.error("[FollowTracker] Failed to send message:", chrome.runtime.lastError);
                }
              }
            );
          } else {
            console.log("[FollowTracker] Chrome runtime not available, skipping message send");
          }
        }
      }
    }
  });

  // 开始观察按钮及其子节点的变化
  observer.observe(followBtn, {
    childList: true,
    subtree: true,
    characterData: true
  });

  console.log("[FollowTracker] Started tracking follow button for UP:", upInfo.mid);
}

/**
 * 初始化关注按钮追踪器
 */
function initFollowTracker(): void {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return;
  }

  // 检查是否在B站页面
  if (!window.location.href.includes("bilibili.com")) {
    return;
  }

  // 等待页面加载完成
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      setTimeout(checkFollowButton, 1000);
    });
  } else {
    setTimeout(checkFollowButton, 1000);
  }
}

if (typeof window !== "undefined") {
  initFollowTracker();
}
