
/**
 * 环境变量定义
 * 
 * 这个文件会在构建时根据 NODE_ENV 环境变量自动生成
 */

// 开发环境: NODE_ENV=development
// 生产环境: NODE_ENV=production

export const LOG_LEVEL = 'debug' as 'debug' | 'info' | 'warn' | 'error' | 'none';
export const IS_DEV = true;
export const IS_PROD = false;
