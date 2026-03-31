
/**
 * 收藏状态触发器
 * 负责监听收藏按钮状态变化，决定何时触发收藏数据的收集
 */

import { FavoriteStatusEvent } from '../types.js';
import { logger } from '../../utils/logger.js';
/**
 * 收藏触发器接口
 */
export interface FavoriteTrigger {
  /** 开始监听收藏事件 */
  start(): void;
  /** 停止监听收藏事件 */
  stop(): void;
  /** 设置数据收集回调 */
  onCollect(callback: (data: FavoriteStatusEvent) => void): void;
}

/**
 * 收藏按钮触发器
 * 监听收藏按钮状态变化
 */
export class FavoriteButtonTrigger implements FavoriteTrigger {
  private callbacks: Array<(data: FavoriteStatusEvent) => void> = [];
  private observer: MutationObserver | null = null;
  private favoriteBtn: HTMLElement | null = null;
  private isRunning = false;

  constructor() {
    this.setupObserver();
  }

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.detectAndObserveButton();
  }

  stop(): void {
    if (!this.isRunning) return;
    this.isRunning = false;
    if (this.observer) {
      this.observer.disconnect();
    }
  }

  onCollect(callback: (data: FavoriteStatusEvent) => void): void {
    this.callbacks.push(callback);
  }

  private detectAndObserveButton(): void {
    const selectors = [
      ".video-fav", // B站收藏按钮的主类名
      ".video-toolbar-left-item.video-fav",
      ".toolbar-left .collect",
      ".video-toolbar .collect",
      ".action-item.collect",
      ".toolbar-left .video-coin-video",
      ".video-toolbar .video-coin-video",
      ".action-item.video-coin-video",
      "[class*='collect']",
      "[class*='favorite']",
      "[class*='fav']",
      ".video-actions .collect-btn",
      ".video-actions .favorite-btn"
    ];

    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el) {
        this.favoriteBtn = el as HTMLElement;
        break;
      }
    }

    if (!this.favoriteBtn) {
      logger.debug("[FavoriteTrigger] Favorite button not found, retrying...");
      setTimeout(() => this.detectAndObserveButton(), 1000);
      return;
    }

    logger.debug("[FavoriteTrigger] Favorite button found, setting up observer");

    // 开始观察按钮变化
    if (this.observer) {
      this.observer.observe(this.favoriteBtn, {
        attributes: true,
        attributeFilter: ["class"]
      });
    }
  }

  private setupObserver(): void {
    this.observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === "attributes" && mutation.attributeName === "class") {
          const target = mutation.target as HTMLElement;
          const isFavorited = target.classList.contains("on");
          this.triggerCollect(isFavorited);
        }
      });
    });
  }

  private triggerCollect(isFavorited: boolean): void {
    const url = window.location.href;
    const bvidMatch = url.match(/\/video\/(BV[a-zA-Z0-9]+)/);
    const bvid = bvidMatch ? bvidMatch[1] : "";

    if (!bvid) {
      logger.debug("[FavoriteTrigger] Not on video page, skipping");
      return;
    }

    const titleElement = document.querySelector("h1.video-title, h1.title");
    const title = titleElement?.textContent?.trim() || "";

    const event: FavoriteStatusEvent = {
      bv: bvid,
      title,
      action: isFavorited ? "add" : "remove",
      timestamp: Date.now()
    };

    logger.debug("[FavoriteTrigger] Favorite status changed:", event);
    this.callbacks.forEach(callback => callback(event));
  }
}
