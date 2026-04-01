
/**
 * 视频相关触发器
 * 负责决定何时触发视频数据的收集
 */

import { WatchEventCollectData } from '../types.js';
import { Timestamp } from '../../database/types/base.js';

/**
 * 视频触发器接口
 */
export interface VideoTrigger {
  /** 开始监听视频事件 */
  start(): void;
  /** 停止监听视频事件 */
  stop(): void;
  /** 设置数据收集回调 */
  onCollect(callback: (data: WatchEventCollectData) => void): void;
}

/**
 * 视频播放触发器
 * 监听视频播放事件，决定何时收集观看进度数据
 */
export class VideoPlaybackTrigger implements VideoTrigger {
  private video: HTMLVideoElement | null = null;
  private bvid: string | null = null;
  private callbacks: Array<(data: WatchEventCollectData) => void> = [];
  private lastTime = 0;
  private accumulated = 0;
  private watchStartTime: Timestamp | null = null;
  private isRunning = false;

  constructor(private videoElement: HTMLVideoElement, bvid: string) {
    this.video = videoElement;
    this.bvid = bvid;
  }

  start(): void {
    if (this.isRunning || !this.video) return;

    this.isRunning = true;
    this.lastTime = this.video.currentTime;
    this.accumulated = 0;
    this.watchStartTime = Date.now();

    // 监听视频事件
    this.video.addEventListener("timeupdate", this.handleTimeUpdate);
    this.video.addEventListener("pause", this.handlePause);
    this.video.addEventListener("ended", this.handleEnded);
    document.addEventListener("visibilitychange", this.handleVisibilityChange);
    window.addEventListener("beforeunload", this.handleBeforeUnload);
  }

  stop(): void {
    if (!this.video) return;

    this.isRunning = false;
    this.video.removeEventListener("timeupdate", this.handleTimeUpdate);
    this.video.removeEventListener("pause", this.handlePause);
    this.video.removeEventListener("ended", this.handleEnded);
    document.removeEventListener("visibilitychange", this.handleVisibilityChange);
    window.removeEventListener("beforeunload", this.handleBeforeUnload);
  }

  onCollect(callback: (data: WatchEventCollectData) => void): void {
    this.callbacks.push(callback);
  }

  private handleTimeUpdate = (): void => {
    if (!this.video) return;

    if (this.video.seeking) {
      this.lastTime = this.video.currentTime;
      return;
    }

    if (!this.video.paused) {
      // 计算实际播放进度
      const delta = this.video.currentTime - this.lastTime;
      if (delta > 0 && delta < 5) {
        this.accumulated += delta;
        this.lastTime = this.video.currentTime;
      }

      // 只有当实际观看时长大于7秒时才触发收集
      if (this.accumulated >= 7) {
        this.triggerCollect("tick");
      }
    }
  };

  private handlePause = (): void => {
    this.triggerCollect("pause");
  };

  private handleEnded = (): void => {
    this.triggerCollect("ended");
  };

  private handleVisibilityChange = (): void => {
    if (document.hidden) {
      this.triggerCollect("hidden");
    }
  };

  private handleBeforeUnload = (): void => {
    this.triggerCollect("unload");
  };

  private triggerCollect(reason: string): void {
    if (this.accumulated < 1 || !this.video || !this.bvid || !this.watchStartTime) {
      return;
    }

    const currentTimestamp = Date.now();
    const videoDuration = Number.isFinite(this.video.duration) ? this.video.duration : 0;
    const progress = videoDuration > 0 ? this.video.currentTime / videoDuration : 0;
    const isComplete = progress >= 0.9 ? 1 : 0;

    const data: WatchEventCollectData = {
      bv: this.bvid,
      watchTime: this.watchStartTime,
      watchDuration: this.accumulated,
      videoDuration,
      progress,
      isComplete,
      endTime: currentTimestamp
    };

    this.callbacks.forEach(callback => callback(data));

    // 重置累计时间和开始时间
    this.accumulated = 0;
    this.watchStartTime = currentTimestamp;
  }
}

/**
 * 视频元数据初始化触发器
 * 在视频页面加载时触发一次，用于收集视频元数据
 */
export class VideoMetadataTrigger implements VideoTrigger {
  private callbacks: Array<(data: WatchEventCollectData) => void> = [];
  private bvid: string | null = null;
  private video: HTMLVideoElement | null = null;
  private timerId: number | null = null;
  private hasTriggered = false;

  constructor(videoElement: HTMLVideoElement, bvid: string) {
    this.video = videoElement;
    this.bvid = bvid;
  }

  start(): void {
    // 防止重复触发
    if (this.hasTriggered) {
      return;
    }

    // 延迟触发，确保页面加载完成
    this.timerId = window.setTimeout(() => {
      this.triggerCollect();
      this.hasTriggered = true;
      this.timerId = null;
    }, 10000);
  }

  stop(): void {
    // 清除定时器
    if (this.timerId !== null) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
    this.hasTriggered = false;
  }

  onCollect(callback: (data: WatchEventCollectData) => void): void {
    this.callbacks.push(callback);
  }

  private triggerCollect(): void {
    if (!this.video || !this.bvid) return;

    const videoDuration = Number.isFinite(this.video.duration) ? this.video.duration : 0;
    const currentTimestamp = Date.now();

    const data: WatchEventCollectData = {
      bv: this.bvid,
      watchTime: currentTimestamp,
      watchDuration: 0,
      videoDuration,
      progress: 0,
      isComplete: 0,
      endTime: currentTimestamp
    };

    this.callbacks.forEach(callback => callback(data));
  }
}
