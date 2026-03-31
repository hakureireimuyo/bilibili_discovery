
/**
 * 数据转发器
 * 统一的数据转发接口，负责将收集到的数据发送到后台
 */

import { DataForwarder } from '../types.js';
import { logger } from '../../utils/logger.js';
/**
 * Chrome消息转发器
 * 实现数据转发接口，通过Chrome消息API发送数据
 */
export class ChromeMessageForwarder implements DataForwarder {
  private logPrefix = "[DataForwarder]";

  /**
   * 发送数据到后台
   */
  send(type: string, data: any): void {
    logger.debug(`${this.logPrefix} Sending ${type}:`, data);

    try {
      if (typeof chrome === "undefined" || typeof chrome.runtime?.sendMessage !== "function") {
        console.warn(`${this.logPrefix} Chrome runtime not available`);
        return;
      }

      chrome.runtime.sendMessage({ type, payload: data }, (response) => {
        if (chrome.runtime.lastError) {
          const errorMsg = chrome.runtime.lastError.message || "";
          // 忽略扩展上下文失效的错误（扩展重新加载时的正常现象）
          if (errorMsg.includes("Extension context invalidated")) {
            logger.debug(`${this.logPrefix} Extension context invalidated, this is expected during reload`);
          } else {
            console.warn(`${this.logPrefix} Send ${type} failed:`, chrome.runtime.lastError);
          }
        } else {
          logger.debug(`${this.logPrefix} Send ${type} success, response:`, response);
        }
      });
    } catch (error) {
      console.warn(`${this.logPrefix} Send ${type} failed`, error);
    }
  }
}

/**
 * 创建默认的数据转发器实例
 */
export function createDataForwarder(): DataForwarder {
  return new ChromeMessageForwarder();
}
