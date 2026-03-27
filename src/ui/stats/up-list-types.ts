
/**
 * UP列表相关类型定义
 * 定义UP列表管理器、元素构建器等核心概念
 */

import type { Creator } from "../../database/types/index.js";
import type { RenderBookConfig, RenderListConfig, IRenderBook } from "../../renderer/types.js";
import type { StatsState } from "./types.js";
import type { ServiceContainer } from "./services.js";

/**
 * UP列表配置
 */
export interface UpListConfig {
  /** 容器元素 */
  container: HTMLElement;
  /** 是否自动渲染 */
  autoRender?: boolean;
  /** 服务容器 */
  services: ServiceContainer;
  /** 渲染书实例 */
  renderBook: IRenderBook<Creator, HTMLElement>;
}

/**
 * UP列表元素构建器接口
 */
export interface IUpListElementBuilder {
  /**
   * 构建单个UP主元素
   */
  buildElement(creator: Creator): Promise<HTMLElement>;

  /**
   * 批量构建UP主元素
   */
  buildElements(creators: Creator[]): Promise<HTMLElement[]>;
}

/**
 * UP列表更新监听器接口
 */
export interface IUpListUpdateListener {
  /**
   * 处理UP列表更新事件
   */
  onUpListUpdate(state: StatsState): void;
}
