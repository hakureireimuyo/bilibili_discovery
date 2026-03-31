
/**
 * 关注状态触发器
 * 负责监听关注按钮状态变化，决定何时触发关注数据的收集
 */

import { FollowStatusEvent } from '../types.js';
import { logger } from '../../utils/logger.js';
/**
 * 关注触发器接口
 */
export interface FollowTrigger {
  /** 开始监听关注事件 */
  start(): void;
  /** 停止监听关注事件 */
  stop(): void;
  /** 设置数据收集回调 */
  onCollect(callback: (data: FollowStatusEvent) => void): void;
}

/**
 * 关注按钮触发器
 * 监听关注按钮状态变化
 */
export class FollowButtonTrigger implements FollowTrigger {
  private callbacks: Array<(data: FollowStatusEvent) => void> = [];
  private observer: MutationObserver | null = null;
  private followBtn: HTMLElement | null = null;
  private isFollowing = false;
  private isRunning = false;
  private debounceTimer: number | null = null; // 防抖定时器

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

  onCollect(callback: (data: FollowStatusEvent) => void): void {
    this.callbacks.push(callback);
  }

  private detectAndObserveButton(): void {
    const url = window.location.href;

    // 根据页面类型选择不同的关注按钮
    if (url.includes('/video/')) {
      // 尝试多种选择器以适配不同版本的B站UI
      this.followBtn = document.querySelector('.follow-btn') ||
                      document.querySelector('.follow-btn-inner')?.parentElement ||
                      document.querySelector('[class*="follow-btn"]');
    } else if (url.includes('space.bilibili.com')) {
      this.followBtn = document.querySelector('.space-follow-btn') ||
                      document.querySelector('[class*="follow-btn"]');
    }

    if (!this.followBtn) {
      logger.debug("[FollowTrigger] Follow button not found, retrying...");
      setTimeout(() => this.detectAndObserveButton(), 2000);
      return;
    }

    // 获取初始关注状态
    this.isFollowing = this.checkFollowStatus();

    // 开始观察按钮变化
    if (this.observer) {
      // 监听按钮及其子元素的所有变化
      this.observer.observe(this.followBtn, {
        childList: true,      // 监听子元素的添加/删除
        subtree: true,        // 监听所有后代元素
        characterData: true,  // 监听文本内容变化
        attributes: true,      // 监听属性变化
        attributeFilter: ['class', 'style'] // 监听class和style属性
      });

      // 同时也监听按钮的父元素，因为按钮可能被整体替换
      const parent = this.followBtn.parentElement;
      if (parent && parent !== document.body) {
        this.observer.observe(parent, {
          childList: true,
          subtree: false,
          characterData: false,
          attributes: false
        });
      }
    }

    logger.debug("[FollowTrigger] Started tracking follow button");
  }

  private setupObserver(): void {
    this.observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'childList' || 
            mutation.type === 'characterData' || 
            mutation.type === 'attributes') {
          // 使用防抖，避免短时间内多次触发
          if (this.debounceTimer !== null) {
            clearTimeout(this.debounceTimer);
          }
          this.debounceTimer = window.setTimeout(() => {
            this.checkStatusChange();
            this.debounceTimer = null;
          }, 300);
        }
      }
    });
  }

  private checkFollowStatus(): boolean {
    if (!this.followBtn) return false;

    const url = window.location.href;

    if (url.includes('/video/')) {
      // 检查是否存在已关注按钮
      const alreadyBtn = this.followBtn.querySelector('.already-btn');
      if (alreadyBtn) {
        return true;
      }

      // 检查按钮文本是否包含"已关注"
      const btnText = this.followBtn.textContent?.trim().toLowerCase() || '';
      if (btnText.includes('已关注')) {
        return true;
      }

      // 检查是否包含van-followed类（新版本UI）
      if (this.followBtn.querySelector('.van-followed')) {
        return true;
      }

      // 回退到检查following类
      return this.followBtn.classList.contains('following');
    } else if (url.includes('space.bilibili.com')) {
      // 检查按钮文本是否包含"已关注"
      const btnText = this.followBtn.textContent?.trim().toLowerCase() || '';
      if (btnText.includes('已关注')) {
        return true;
      }

      // 检查gray类
      return this.followBtn.classList.contains('gray');
    }

    return false;
  }

  private checkStatusChange(): void {
    const newIsFollowing = this.checkFollowStatus();

    if (newIsFollowing !== this.isFollowing) {
      const event: FollowStatusEvent = {
        creator: {
          isFollowing: newIsFollowing ? 1 : 0,
          followTime: newIsFollowing ? Date.now() : 0
        },
        isFollowing: newIsFollowing,
        timestamp: Date.now()
      };

      logger.debug("[FollowTrigger] Follow status changed:", event);
      this.callbacks.forEach(callback => callback(event));
      this.isFollowing = newIsFollowing;
    }
  }
}
