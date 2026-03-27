
/**
 * 渲染书相关类型定义
 * 定义渲染书、元素构建器和页面渲染结果等核心概念
 */

import type { Book, BookPageState, BookQueryOptions } from '../database/query-server/book/types.js';
import type { QueryCondition } from '../database/query-server/query/types.js';

/**
 * 索引更新监听器接口
 * 定义监听器必须实现的方法
 * 职责：接收索引更新通知，执行相应的更新操作
 */
export interface IIndexUpdateListener {
  /**
   * 处理索引更新事件
   * @param bookId - 书的ID
   * @param condition - 新的查询条件
   */
  onIndexUpdate(bookId: number, condition: QueryCondition): void;
}

/**
 * 元素构建器接口
 * 定义元素构建器必须实现的方法
 * 职责：接收数据对象，生成网页元素
 */
export interface IElementBuilder<TData, TElement> {
  /**
   * 将单个数据对象转换为网页元素
   * @param data - 数据对象
   * @returns 网页元素
   */
  buildElement(data: TData): TElement | Promise<TElement>;

  /**
   * 批量将数据对象转换为网页元素
   * @param dataList - 数据对象列表
   * @returns 网页元素列表
   */
  buildElements(dataList: TData[]): TElement[] | Promise<TElement[]>;

  /**
   * 更新已有的网页元素
   * @param element - 已有的网页元素
   * @param data - 新的数据对象
   */
  updateElement?(element: TElement, data: TData): void | Promise<void>;
}

/**
 * 渲染页数据
 * 存储网页元素及其元数据
 */
export interface RenderPage<TElement> {
  /** 页码 */
  page: number;
  /** 网页元素列表 */
  elements: TElement[];
  /** 是否已渲染 */
  rendered: boolean;
  /** 渲染时间戳 */
  renderTime?: number;
}

/**
 * 渲染书查询结果
 */
export interface RenderQueryResult<TElement> {
  /** 当前页网页元素 */
  elements: TElement[];
  /** 分页状态 */
  state: BookPageState;
  /** 书的ID */
  bookId: number;
}

/**
 * 渲染书配置
 */
export interface RenderBookConfig<TData, TElement> {
  /** 书实例 */
  book: Book<TData>;
  /** 元素构建器 */
  elementBuilder: IElementBuilder<TData, TElement>;
  /** 最大缓存页数 */
  maxCachePages?: number;
}

/**
 * 渲染列表更新监听器接口
 * 定义监听器必须实现的方法
 * 职责：接收渲染书更新通知，执行相应的更新操作
 */
export interface IRenderListUpdateListener {
  /**
   * 处理渲染书更新事件
   * @param bookId - 书的ID
   */
  onRenderBookUpdate(bookId: number): void;
}

/**
 * 渲染书接口
 * 定义渲染书必须实现的方法
 */
export interface IRenderBook<TData, TElement> {
  bookId: number;
  state: BookPageState;
  getPage(page: number, options?: BookQueryOptions): Promise<RenderQueryResult<TElement>>;
  updateIndex(newCondition: QueryCondition): Promise<void>;
  registerUpdateListener(listener: IRenderListUpdateListener): void;
  unregisterUpdateListener(listener: IRenderListUpdateListener): void;
}

/**
 * 渲染列表配置
 */
export interface RenderListConfig<TData, TElement> {
  /** 渲染书实例 */
  renderBook: IRenderBook<TData, TElement>;
  /** 容器元素 */
  container: HTMLElement;
  /** 是否自动渲染 */
  autoRender?: boolean;
}
