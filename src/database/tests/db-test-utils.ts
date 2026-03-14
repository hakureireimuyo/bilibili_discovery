/**
 * 数据库测试工具
 * 提供在非浏览器环境中测试数据库的功能
 */

import { DBManager } from '../indexeddb/db-manager';
import { DB_NAME, DB_VERSION } from '../indexeddb/config';

// 导入 fake-indexeddb
// 注意：这需要在测试环境中安装 fake-indexeddb 库
// npm install --save-dev fake-indexeddb

/**
 * 初始化测试环境
 * 使用 fake-indexeddb 替代浏览器环境的 IndexedDB
 */
export function initTestEnvironment(): void {
  // 检查是否在浏览器环境中
  if (typeof indexedDB === 'undefined') {
    // 如果不在浏览器环境中，使用 fake-indexeddb
    try {
      // 动态导入 fake-indexeddb
      const fakeIndexedDB = require('fake-indexeddb');
      // @ts-ignore
      global.indexedDB = fakeIndexedDB;
      console.log('[Test] Using fake-indexeddb for testing');
    } catch (error) {
      console.error('[Test] Failed to load fake-indexeddb:', error);
      console.error('[Test] Please install fake-indexeddb: npm install --save-dev fake-indexeddb');
      throw error;
    }
  }
}

/**
 * 设置测试数据库
 * 创建一个独立的测试数据库实例
 */
export async function setupTestDatabase(): Promise<DBManager> {
  // 初始化测试环境
  initTestEnvironment();

  // 创建新的数据库管理器实例
  const dbManager = new DBManager();

  // 初始化数据库
  await dbManager.init();

  return dbManager;
}

/**
 * 清理测试数据库
 * 删除测试数据库并关闭连接
 */
export async function cleanupTestDatabase(dbManager: DBManager): Promise<void> {
  await dbManager.deleteDatabase();
}

/**
 * 重置测试数据库
 * 删除所有数据但保留数据库结构
 */
export async function resetTestDatabase(dbManager: DBManager): Promise<void> {
  // 关闭当前数据库连接
  dbManager.close();

  // 删除数据库
  await dbManager.deleteDatabase();

  // 重新初始化数据库
  await dbManager.init();
}
