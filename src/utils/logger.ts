
/**
 * 统一日志工具
 * 支持通过编译时环境变量控制日志输出
 * 
 * 使用方法:
 * import { logger } from './logger.js';
 * logger.info('信息');
 * logger.debug('调试信息');
 * logger.warn('警告');
 * logger.error('错误');
 */

import { LOG_LEVEL } from '../env.js';

// 从环境变量获取日志级别

// 日志级别定义
enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4
}

// 将字符串转换为日志级别
function parseLogLevel(level: string): LogLevel {
  switch (level.toLowerCase()) {
    case 'debug': return LogLevel.DEBUG;
    case 'info': return LogLevel.INFO;
    case 'warn': return LogLevel.WARN;
    case 'error': return LogLevel.ERROR;
    case 'none': return LogLevel.NONE;
    default: return LogLevel.DEBUG;
  }
}

const currentLogLevel = parseLogLevel(LOG_LEVEL);

/**
 * 日志工具类
 */
class Logger {
  private prefix: string;

  constructor(prefix: string = '') {
    this.prefix = prefix;
  }

  private formatMessage(level: string, ...args: unknown[]): string {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level}]${this.prefix ? ` [${this.prefix}]` : ''}`;
  }

  debug(...args: unknown[]): void {
    if (currentLogLevel <= LogLevel.DEBUG) {
      console.log(this.formatMessage('DEBUG'), ...args);
    }
  }

  info(...args: unknown[]): void {
    if (currentLogLevel <= LogLevel.INFO) {
      console.info(this.formatMessage('INFO'), ...args);
    }
  }

  warn(...args: unknown[]): void {
    if (currentLogLevel <= LogLevel.WARN) {
      console.warn(this.formatMessage('WARN'), ...args);
    }
  }

  error(...args: unknown[]): void {
    if (currentLogLevel <= LogLevel.ERROR) {
      console.error(this.formatMessage('ERROR'), ...args);
    }
  }

  /**
   * 创建带有特定前缀的子logger
   */
  child(prefix: string): Logger {
    return new Logger(this.prefix ? `${this.prefix}:${prefix}` : prefix);
  }
}

// 导出默认logger实例
export const logger = new Logger();

// 导出Logger类供创建自定义实例
export { Logger };
