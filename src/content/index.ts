
/**
 * Content Script 主入口
 * 整合触发器、收集器、转发器和数据处理器
 */
import { logger } from '../utils/logger.js';

logger.debug("[ContentScript] Loading new content script...");

import { 
  WatchEventCollectData, 
  FollowStatusEvent, 
  FavoriteStatusEvent,
  VideoCollectData, 
} from './types.js';
import { VideoPlaybackTrigger, VideoMetadataTrigger } from './triggers/video-trigger.js';
import { FollowButtonTrigger } from './triggers/follow-trigger.js';
import { FavoriteButtonTrigger } from './triggers/favorite-trigger.js';
import { VideoDataCollector } from './collectors/video-collector.js';
import { UpDataCollector } from './collectors/up-collector.js';
import { createDataForwarder } from './forwarder/data-forwarder.js';
import { DataProcessor } from './processors/data-processor.js';
import { Platform } from '../database/types/index.js';
/**
 * 视频追踪器管理器
 */
class VideoTrackerManager {
  private playbackTrigger: VideoPlaybackTrigger | null = null;
  private metadataTrigger: VideoMetadataTrigger | null = null;
  private videoCollector = new VideoDataCollector();
  private upCollector = new UpDataCollector();
  private forwarder = createDataForwarder();
  private bvid: string | null = null;
  private videoSrcObserver: MutationObserver | null = null;
  private initialVideoData: VideoCollectData | null = null; // 缓存初始视频数据
  private userMid: number | null = null;

  constructor() {
    logger.debug("[VideoTrackerManager] Creating VideoTrackerManager instance");
    this.initialize();
  }

  private async initialize(): Promise<void> {
    logger.debug("[VideoTrackerManager] Initializing...");
    if (typeof window === "undefined" || typeof document === "undefined") {
      logger.debug("[VideoTrackerManager] Window or document not available, skipping");
      return;
    }

    this.bvid = this.extractBvidFromUrl(window.location.href);
    if (!this.bvid) {
      return;
    }

    logger.debug(`[VideoTracker] Video detected: ${this.bvid}`);

    // 获取用户UID
    try {
      const { getValue } = await import('../database/implementations/index.js');
      const settings = await getValue('settings') as { userId?: number } | null;
      this.userMid = settings?.userId || null;
      logger.debug("[VideoTrackerManager] User mid:", this.userMid);
    } catch (error) {
      console.error("[VideoTrackerManager] Failed to load user settings:", error);
    }

    // 等待视频元素加载
    this.waitForVideoElement();
  }

  private waitForVideoElement(): void {
    const video = this.detectVideoElement();
    if (!video) {
      logger.debug("[VideoTracker] Video element not found, retrying...");
      setTimeout(() => {
        const retryVideo = this.detectVideoElement();
        if (retryVideo) {
          logger.debug("[VideoTracker] Video element found on retry, waiting 5 seconds for page to fully load");
          setTimeout(() => {
            this.setupTriggers(retryVideo);
          }, 5000);
        } else {
          logger.debug("[VideoTracker] Video element still not found, will try again later");
          setTimeout(() => this.waitForVideoElement(), 2000);
        }
      }, 1000);
      return;
    }

    logger.debug("[VideoTracker] Video element found, waiting 5 seconds for page to fully load");
    setTimeout(() => {
      this.setupTriggers(video);
    }, 5000);
  }

  private async setupTriggers(video: HTMLVideoElement): Promise<void> {
    if (!this.bvid) return;

    logger.debug("[VideoTrackerManager] 开始收集视频数据, bvid:", this.bvid);

    // 先收集视频数据
    const videoData = await this.videoCollector.collectVideoData(this.bvid!, video.duration);
    logger.debug("[VideoTrackerManager] 收集到的视频数据:", videoData);

    if (videoData) {
      // 从 DOM 中收集 UP 主信息（包括关注状态）
      const creatorData = this.upCollector.collectCreatorData();
      logger.debug("[VideoTrackerManager] 从 DOM 收集到的 UP 主信息:", creatorData);

      // 如果成功收集到 UP 主信息，发送到后台
      if (creatorData) {
        this.forwarder.send('CREATOR_DATA', creatorData);
        logger.debug("[VideoTrackerManager] UP 主信息已发送到后台");
      }

      // 检查是否是用户自己的视频
      if (this.userMid && videoData.creatorId === this.userMid) {
        logger.debug("[VideoTrackerManager] 跳过用户自己的视频, mid:", this.userMid);
        return;
      }
      logger.debug("[VideoTrackerManager] 视频UP主ID:", videoData.creatorId, "用户ID:", this.userMid);
      // 缓存初始视频数据
      this.initialVideoData = videoData;

      // 使用转发器发送视频数据到后台
      this.forwarder.send('VIDEO_DATA', videoData);
      logger.debug("[VideoTrackerManager] 视频数据已发送, 开始播放追踪");
      // 视频数据发送后，再启动播放触发器
      this.startPlaybackTrigger(video);
    } else {
      logger.debug("[VideoTrackerManager] 收集视频数据失败, 2秒后重试");
      setTimeout(() => this.setupTriggers(video), 2000);
      return;
    }

    // 创建元数据触发器（用于更新视频时长）
    this.metadataTrigger = new VideoMetadataTrigger(video, this.bvid);
    this.metadataTrigger.onCollect(async (data: WatchEventCollectData) => {
      // 只更新视频时长，不重新收集完整数据
      if (this.initialVideoData) {
        this.initialVideoData.duration = data.videoDuration;
        // 使用转发器发送更新后的视频数据到后台
        this.forwarder.send('VIDEO_DATA', this.initialVideoData);
      }
    });
    this.metadataTrigger.start();

    // 监听视频元素src变化（用于检测同一页面的视频切换）
    this.setupVideoSrcWatcher(video);

    // 监听URL变化
    this.setupUrlWatcher();
  }

  private startPlaybackTrigger(video: HTMLVideoElement): void {
    if (!this.bvid) return;

    // 创建播放触发器
    this.playbackTrigger = new VideoPlaybackTrigger(video, this.bvid);
    this.playbackTrigger.onCollect((data: WatchEventCollectData) => {
      // 使用转发器发送观看事件数据到后台
      this.forwarder.send('WATCH_EVENT', data);
    });
    this.playbackTrigger.start();
  }

  private setupVideoSrcWatcher(video: HTMLVideoElement): void {
    // 如果已有观察器，先断开
    if (this.videoSrcObserver) {
      this.videoSrcObserver.disconnect();
    }

    let lastSrc = video.src;

    // 使用MutationObserver监听视频元素属性变化
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'src') {
          const currentSrc = video.src;
          if (currentSrc !== lastSrc) {
            logger.debug("[VideoTracker] Video src changed, reinitializing...");
            logger.debug("[VideoTracker] Old src:", lastSrc);
            logger.debug("[VideoTracker] New src:", currentSrc);

            lastSrc = currentSrc;

            // 从URL中提取新的BVID
            const newBvid = this.extractBvidFromUrl(window.location.href);
            if (newBvid && newBvid !== this.bvid) {
              logger.debug("[VideoTracker] BVID changed from", this.bvid, "to", newBvid);
              this.bvid = newBvid;

              // 停止旧的触发器
              if (this.playbackTrigger) {
                this.playbackTrigger.stop();
              }
              if (this.metadataTrigger) {
                this.metadataTrigger.stop();
              }

              // 清空缓存的视频数据
              this.initialVideoData = null;

              // 等待5秒后重新初始化触发器
              setTimeout(() => {
                logger.debug("[VideoTracker] Reinitializing triggers for new video");
                this.setupTriggers(video);
              }, 5000);
            }
          }
        }
      });
    });

    // 配置观察选项
    const config = {
      attributes: true,
      attributeFilter: ['src']
    };

    // 开始观察视频元素
    observer.observe(video, config);

    // 保存观察器实例
    this.videoSrcObserver = observer;
  }

  private setupUrlWatcher(): void {
    let lastBvid = this.bvid;

    setInterval(() => {
      const currentBvid = this.extractBvidFromUrl(window.location.href);
      if (currentBvid && currentBvid !== lastBvid) {
        logger.debug("[VideoTracker] BVID changed, reinitializing...");
        logger.debug("[VideoTracker] Old BVID:", lastBvid);
        logger.debug("[VideoTracker] New BVID:", currentBvid);

        lastBvid = currentBvid;
        this.bvid = currentBvid;

        // 重置触发器
        if (this.playbackTrigger) {
          this.playbackTrigger.stop();
        }
        if (this.metadataTrigger) {
          this.metadataTrigger.stop();
        }

        // 清空缓存的视频数据
        this.initialVideoData = null;

        // 重新初始化
        setTimeout(() => {
          logger.debug("[VideoTracker] Page should have loaded new content, reinitializing...");
          this.waitForVideoElement();
        }, 3000);
      }
    }, 4000);
  }

  private extractBvidFromUrl(url: string): string | null {
    const match = url.match(/\/video\/(BV[a-zA-Z0-9]+)/);
    return match ? match[1] : null;
  }

  private detectVideoElement(): HTMLVideoElement | null {
    return document.querySelector("video");
  }
}

/**
 * 关注追踪器管理器
 */
class FollowTrackerManager {
  private trigger: FollowButtonTrigger;
  private collector = new UpDataCollector();
  private forwarder = createDataForwarder();
  private userMid: number | null = null;

  constructor() {
    this.trigger = new FollowButtonTrigger();
    this.initialize();
  }

  private async initialize(): Promise<void> {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return;
    }

    // 检查是否在B站页面
    if (!window.location.href.includes("bilibili.com")) {
      return;
    }

    // 检查是否在视频页面或UP主页
    const url = window.location.href;
    if (!url.includes('/video/') && !url.includes('space.bilibili.com')) {
      return;
    }

    // 获取用户UID
    try {
      const { getValue } = await import('../database/implementations/index.js');
      const settings = await getValue('settings') as { userId?: number } | null;
      this.userMid = settings?.userId || null;
      logger.debug("[FollowTracker] User mid:", this.userMid);
    } catch (error) {
      console.error("[FollowTracker] Failed to load user settings:", error);
    }

    // 设置触发器回调
    this.trigger.onCollect((data: FollowStatusEvent) => {
      const creatorData = this.collector.collectCreatorData();
      if (creatorData) {
        // 检查是否是用户自己的关注状态
        if (this.userMid && creatorData.creatorId === this.userMid) {
          logger.debug("[FollowTracker] Skipping user's own follow status, mid:", this.userMid);
          return;
        }

        // 更新关注状态
        creatorData.isFollowing = data.isFollowing ? 1 : 0;
        creatorData.followTime = data.isFollowing ? Date.now() : 0;

        logger.debug("[FollowTracker] Follow status changed:", creatorData);

        // 使用转发器发送UP主数据到后台
        this.forwarder.send('CREATOR_DATA', creatorData);

        // 触发自定义事件，供外部监听
        window.dispatchEvent(new CustomEvent('followStatusChanged', { detail: creatorData }));
      }
    });

    // 延迟开始监听，等待页面完全加载
    setTimeout(() => {
      logger.debug("[FollowTracker] Starting follow button tracking after page load");
      this.trigger.start();
    }, 5000);
  }
}

/**
 * 收藏追踪器管理器
 */
class FavoriteTrackerManager {
  private trigger: FavoriteButtonTrigger;
  private forwarder = createDataForwarder();

  constructor() {
    this.trigger = new FavoriteButtonTrigger();
    this.initialize();
  }

  private initialize(): void {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return;
    }

    // 检查是否在B站页面
    if (!window.location.href.includes("bilibili.com")) {
      return;
    }

    // 检查是否在视频页面
    const url = window.location.href;
    if (!url.includes("/video/")) {
      return;
    }

    // 设置触发器回调
    this.trigger.onCollect((data: FavoriteStatusEvent) => {
      logger.debug("[FavoriteTracker] Favorite status changed:", data);

      // 使用转发器发送收藏事件数据到后台
      this.forwarder.send('FAVORITE_EVENT', data);

      // 触发自定义事件，供外部监听
      window.dispatchEvent(new CustomEvent('favoriteStatusChanged', { detail: data }));
    });

    // 开始监听
    this.trigger.start();
  }
}

/**
 * UP页面数据收集管理器
 */
class UPPageCollectorManager {
  private collector = new UpDataCollector();
  private forwarder = createDataForwarder();
  private mid: number | null = null;
  private userMid: number | null = null;

  constructor() {
    this.initialize();
  }

  private async initialize(): Promise<void> {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return;
    }

    const midMatch = window.location.href.match(/space\.bilibili\.com\/(\d+)/);
    if (!midMatch) {
      logger.debug("[UPPageCollector] Not a UP page, skipping");
      return;
    }

    this.mid = parseInt(midMatch[1], 10);
    logger.debug("[UPPageCollector] UP page detected, mid:", this.mid);

    // 获取用户UID
    try {
      const { getValue } = await import('../database/implementations/index.js');
      const settings = await getValue('settings') as { userId?: number } | null;
      this.userMid = settings?.userId || null;
      logger.debug("[UPPageCollector] User mid:", this.userMid);
    } catch (error) {
      console.error("[UPPageCollector] Failed to load user settings:", error);
    }

    // 延迟收集数据，等待页面完全加载
    setTimeout(() => this.collectData(), 5000);
  }

  private async collectData(): Promise<void> {
    if (!this.mid) return;

    // 检查是否是用户自己的主页
    if (this.userMid && this.mid === this.userMid) {
      logger.debug("[UPPageCollector] Skipping user's own page, mid:", this.mid);
      return;
    }

    logger.debug("[UPPageCollector] Attempting to collect data for mid:", this.mid);

    const creatorData = this.collector.collectCreatorData();

    if (creatorData) {
      logger.debug("[UPPageCollector] Data collected successfully:", {
        creatorId: creatorData.creatorId,
        name: creatorData.name,
        description: creatorData.description
      });

      // 使用转发器发送UP主数据到后台
      this.forwarder.send('CREATOR_DATA', creatorData);

      // 同时也发送UP页面数据（用于视频列表等）
      const upPageData = this.collector.extractUPPageData();
      if (upPageData) {
        this.forwarder.send('UP_PAGE_DATA', upPageData);
      }
    } else {
      // 检查UP是否无效
      const pageTitle = document.title;
      const pageContent = document.body.innerText;

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
        logger.debug("[UPPageCollector] UP appears to be invalid, sending invalid UP message");
        this.forwarder.send('CREATOR_DATA', {
          creatorId: this.mid,
          platform: Platform.BILIBILI,
          name: "",
          avatarUrl: "",
          description: "",
          isFollowing: 0,
          followTime: 0
        });
      } else {
        logger.debug("[UPPageCollector] Data collection failed, retrying in 1 second...");
        setTimeout(() => this.collectData(), 1000);
      }
    }
  }
}

/**
 * 初始化所有追踪器
 */
function initializeTrackers(): void {
  logger.debug("[ContentScript] Initializing trackers...");
  try {
    // 初始化视频追踪器
    new VideoTrackerManager();

    // 初始化关注追踪器
    new FollowTrackerManager();

    // 初始化收藏追踪器
    new FavoriteTrackerManager();

    // 初始化UP页面收集器
    new UPPageCollectorManager();

    logger.debug("[ContentScript] All trackers initialized successfully");
  } catch (error) {
    console.error("[ContentScript] Error during initialization:", error);
    // 如果初始化出错，延迟重试
    setTimeout(initializeTrackers, 2000);
  }
}

// 确保页面完全加载后再初始化
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeTrackers);
} else {
  initializeTrackers();
}
