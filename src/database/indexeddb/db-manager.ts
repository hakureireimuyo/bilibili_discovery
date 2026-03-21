/**
 * IndexedDB 数据库管理器
 * 负责数据库的初始化、连接和版本管理
 */

import { DB_NAME, DB_VERSION, STORE_NAMES, INDEX_DEFINITIONS, KEY_PATHS } from './config.js';

/**
 * 数据库管理器类
 */
export class DBManager {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;
  private dbName: string = DB_NAME;

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
  async init(customDbName?: string): Promise<IDBDatabase> {
    if (customDbName) {
      this.dbName = customDbName;
    }
    
    if (this.initPromise) {
      await this.initPromise;
      return this.db!;
    }

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, DB_VERSION);

      request.onerror = () => {
        reject(new Error(`Failed to open database: ${request.error}`));
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const transaction = request.transaction;
        this.createObjectStores(db, transaction ?? undefined);
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
  private createObjectStores(db: IDBDatabase, upgradeTransaction?: IDBTransaction): void {
    const currentStoreNames = new Set(Object.values(STORE_NAMES));

    // 不再兼容任何旧结构，升级时直接清理不属于当前 schema 的 store。
    Array.from(db.objectStoreNames).forEach((storeName) => {
      if (!currentStoreNames.has(storeName as (typeof STORE_NAMES)[keyof typeof STORE_NAMES])) {
        db.deleteObjectStore(storeName);
      }
    });

    // 遍历所有存储名称
    Object.values(STORE_NAMES).forEach(storeName => {
      let store: IDBObjectStore;
      // 如果存储不存在则创建
      if (!db.objectStoreNames.contains(storeName)) {
        store = db.createObjectStore(storeName, {
          keyPath: KEY_PATHS[storeName],
          autoIncrement: false
        });
      } else {
        if (!upgradeTransaction) {
          return;
        }
        store = upgradeTransaction.objectStore(storeName);
      }

      // 创建索引（如果定义了索引）
      const indexes = INDEX_DEFINITIONS[storeName as keyof typeof INDEX_DEFINITIONS];
      if (indexes) {
        indexes.forEach((index: { name: string; keyPath: string; options: IDBIndexParameters }) => {
          if (!store.indexNames.contains(index.name)) {
            store.createIndex(index.name, index.keyPath, index.options);
          }
        });
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
    
    // 等待一段时间，确保所有事务完成
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase(this.dbName);
      
      // 设置超时，防止无限等待
      const timeout = setTimeout(() => {
        resolve();
      }, 5000);
      
      request.onsuccess = () => {
        clearTimeout(timeout);
        resolve();
      };
      
      request.onerror = () => {
        clearTimeout(timeout);
        reject(new Error(`Failed to delete database: ${request.error}`));
      };
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

    try {
      const db = await this.getDB();

      const transaction = db.transaction(storeName, mode);

      const store = transaction.objectStore(storeName);
      
      return store;
    } catch (error) {
      console.error(`[DBManager] Error getting store ${storeName}:`, error);
      throw error;
    }
  }
}

// 导出单例
export const dbManager = new DBManager();
