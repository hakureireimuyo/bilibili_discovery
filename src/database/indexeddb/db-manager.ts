/**
 * IndexedDB 数据库管理器
 * 负责数据库的初始化、连接和版本管理
 */

import { DB_NAME, DB_VERSION, STORE_NAMES, INDEX_DEFINITIONS, KEY_PATHS } from './config';

/**
 * 数据库管理器类
 */
class DBManager {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  /**
   * 初始化数据库
   * 
   * @returns Promise<IDBDatabase>
   * 
   * 职责：
   * - 打开数据库连接
   * - 创建对象存储
   * - 创建索引
   * - 处理版本升级
   * 
   * 能力边界：
   * - 不处理数据迁移
   * - 不处理数据备份
   */
  async init(): Promise<IDBDatabase> {
    if (this.initPromise) {
      await this.initPromise;
      return this.db!;
    }

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        reject(new Error(`Failed to open database: ${request.error}`));
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        this.createObjectStores(db);
      };
    });

    await this.initPromise;
    return this.db!;
  }

  /**
   * 创建对象存储
   * 
   * @param db - 数据库实例
   * 
   * 职责：
   * - 创建所有对象存储
   * - 创建所有索引
   */
  private createObjectStores(db: IDBDatabase): void {
    // 遍历所有存储名称
    Object.values(STORE_NAMES).forEach(storeName => {
      // 如果存储不存在则创建
      if (!db.objectStoreNames.contains(storeName)) {
        const store = db.createObjectStore(storeName, {
          keyPath: KEY_PATHS[storeName],
          autoIncrement: false
        });

        // 创建索引
        const indexes = INDEX_DEFINITIONS[storeName];
        if (indexes) {
          indexes.forEach(index => {
            if (!store.indexNames.contains(index.name)) {
              store.createIndex(index.name, index.keyPath, index.options);
            }
          });
        }
      }
    });
  }

  /**
   * 获取数据库实例
   * 
   * @returns Promise<IDBDatabase>
   * 
   * 职责：
   * - 返回数据库实例
   * - 如果未初始化则自动初始化
   */
  async getDB(): Promise<IDBDatabase> {
    if (!this.db) {
      return this.init();
    }
    return this.db;
  }

  /**
   * 关闭数据库连接
   * 
   * 职责：
   * - 关闭数据库连接
   * - 清理资源
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.initPromise = null;
    }
  }

  /**
   * 删除数据库
   * 
   * 职责：
   * - 删除整个数据库
   * - 清理所有数据
   * 
   * 注意：此操作不可逆，请谨慎使用
   */
  async deleteDatabase(): Promise<void> {
    this.close();
    return new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase(DB_NAME);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error(`Failed to delete database: ${request.error}`));
    });
  }

  /**
   * 获取对象存储
   * 
   * @param storeName - 存储名称
   * @param mode - 事务模式
   * @returns Promise<IDBObjectStore>
   * 
   * 职责：
   * - 获取指定对象存储
   * - 创建事务
   */
  async getStore(storeName: string, mode: IDBTransactionMode = 'readonly'): Promise<IDBObjectStore> {
    const db = await this.getDB();
    const transaction = db.transaction(storeName, mode);
    return transaction.objectStore(storeName);
  }
}

// 导出单例
export const dbManager = new DBManager();
