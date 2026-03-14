/**
 * IndexedDB 基础操作工具类
 * 提供通用的数据库操作方法
 */

import { dbManager } from './db-manager';
import { STORE_NAMES } from './config';

/**
 * 数据库操作工具类
 */
export class DBUtils {
  /**
   * 添加数据
   * 
   * @param storeName - 存储名称
   * @param data - 要添加的数据
   * @returns Promise<void>
   */
  static async add<T>(storeName: string, data: T): Promise<void> {
    const store = await dbManager.getStore(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.add(data);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error(`Failed to add data: ${request.error}`));
    });
  }

  /**
   * 批量添加数据
   * 
   * @param storeName - 存储名称
   * @param dataList - 要添加的数据列表
   * @returns Promise<void>
   */
  static async addBatch<T>(storeName: string, dataList: T[]): Promise<void> {
    const store = await dbManager.getStore(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
      dataList.forEach(data => {
        store.add(data);
      });

      const transaction = store.transaction;
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(new Error(`Failed to add batch data: ${transaction.error}`));
    });
  }

  /**
   * 更新数据
   * 
   * @param storeName - 存储名称
   * @param data - 要更新的数据
   * @returns Promise<void>
   */
  static async put<T>(storeName: string, data: T): Promise<void> {
    const store = await dbManager.getStore(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.put(data);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error(`Failed to update data: ${request.error}`));
    });
  }

  /**
   * 批量更新数据
   * 
   * @param storeName - 存储名称
   * @param dataList - 要更新的数据列表
   * @returns Promise<void>
   */
  static async putBatch<T>(storeName: string, dataList: T[]): Promise<void> {
    const store = await dbManager.getStore(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
      dataList.forEach(data => {
        store.put(data);
      });

      const transaction = store.transaction;
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(new Error(`Failed to update batch data: ${transaction.error}`));
    });
  }

  /**
   * 删除数据
   * 
   * @param storeName - 存储名称
   * @param key - 主键
   * @returns Promise<void>
   */
  static async delete(storeName: string, key: IDBValidKey): Promise<void> {
    const store = await dbManager.getStore(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error(`Failed to delete data: ${request.error}`));
    });
  }

  /**
   * 批量删除数据
   * 
   * @param storeName - 存储名称
   * @param keys - 主键列表
   * @returns Promise<void>
   */
  static async deleteBatch(storeName: string, keys: IDBValidKey[]): Promise<void> {
    const store = await dbManager.getStore(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
      keys.forEach(key => {
        store.delete(key);
      });

      const transaction = store.transaction;
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(new Error(`Failed to delete batch data: ${transaction.error}`));
    });
  }

  /**
   * 获取数据
   * 
   * @param storeName - 存储名称
   * @param key - 主键
   * @returns Promise<T | null>
   */
  static async get<T>(storeName: string, key: IDBValidKey): Promise<T | null> {
    const store = await dbManager.getStore(storeName, 'readonly');
    return new Promise((resolve, reject) => {
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(new Error(`Failed to get data: ${request.error}`));
    });
  }

  /**
   * 批量获取数据
   * 
   * @param storeName - 存储名称
   * @param keys - 主键列表
   * @returns Promise<T[]>
   */
  static async getBatch<T>(storeName: string, keys: IDBValidKey[]): Promise<T[]> {
    const store = await dbManager.getStore(storeName, 'readonly');
    return new Promise((resolve, reject) => {
      const results: T[] = [];
      let completed = 0;

      keys.forEach(key => {
        const request = store.get(key);
        request.onsuccess = () => {
          if (request.result) {
            results.push(request.result);
          }
          completed++;
          if (completed === keys.length) {
            resolve(results);
          }
        };
        request.onerror = () => reject(new Error(`Failed to get batch data: ${request.error}`));
      });
    });
  }

  /**
   * 获取所有数据
   * 
   * @param storeName - 存储名称
   * @returns Promise<T[]>
   */
  static async getAll<T>(storeName: string): Promise<T[]> {
    const store = await dbManager.getStore(storeName, 'readonly');
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(new Error(`Failed to get all data: ${request.error}`));
    });
  }

  /**
   * 使用索引查询数据
   * 
   * @param storeName - 存储名称
   * @param indexName - 索引名称
   * @param value - 查询值
   * @returns Promise<T[]>
   */
  static async getByIndex<T>(storeName: string, indexName: string, value: IDBValidKey): Promise<T[]> {
    const store = await dbManager.getStore(storeName, 'readonly');
    const index = store.index(indexName);
    return new Promise((resolve, reject) => {
      const request = index.getAll(value);
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(new Error(`Failed to get by index: ${request.error}`));
    });
  }

  /**
   * 使用索引范围查询数据
   * 
   * @param storeName - 存储名称
   * @param indexName - 索引名称
   * @param range - 查询范围
   * @returns Promise<T[]>
   */
  static async getByIndexRange<T>(
    storeName: string,
    indexName: string,
    range: IDBKeyRange
  ): Promise<T[]> {
    const store = await dbManager.getStore(storeName, 'readonly');
    const index = store.index(indexName);
    return new Promise((resolve, reject) => {
      const request = index.getAll(range);
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(new Error(`Failed to get by index range: ${request.error}`));
    });
  }

  /**
   * 使用索引查询单条数据
   * 
   * @param storeName - 存储名称
   * @param indexName - 索引名称
   * @param value - 查询值
   * @returns Promise<T | null>
   */
  static async getOneByIndex<T>(storeName: string, indexName: string, value: IDBValidKey): Promise<T | null> {
    const store = await dbManager.getStore(storeName, 'readonly');
    const index = store.index(indexName);
    return new Promise((resolve, reject) => {
      const request = index.get(value);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(new Error(`Failed to get one by index: ${request.error}`));
    });
  }

  /**
   * 清空存储
   * 
   * @param storeName - 存储名称
   * @returns Promise<void>
   */
  static async clear(storeName: string): Promise<void> {
    const store = await dbManager.getStore(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error(`Failed to clear store: ${request.error}`));
    });
  }

  /**
   * 计数
   * 
   * @param storeName - 存储名称
   * @returns Promise<number>
   */
  static async count(storeName: string): Promise<number> {
    const store = await dbManager.getStore(storeName, 'readonly');
    return new Promise((resolve, reject) => {
      const request = store.count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error(`Failed to count: ${request.error}`));
    });
  }

  /**
   * 使用索引计数
   * 
   * @param storeName - 存储名称
   * @param indexName - 索引名称
   * @param value - 查询值
   * @returns Promise<number>
   */
  static async countByIndex(storeName: string, indexName: string, value: IDBValidKey): Promise<number> {
    const store = await dbManager.getStore(storeName, 'readonly');
    const index = store.index(indexName);
    return new Promise((resolve, reject) => {
      const request = index.count(value);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error(`Failed to count by index: ${request.error}`));
    });
  }

  /**
   * 使用索引范围计数
   * 
   * @param storeName - 存储名称
   * @param indexName - 索引名称
   * @param range - 查询范围
   * @returns Promise<number>
   */
  static async countByIndexRange(
    storeName: string,
    indexName: string,
    range: IDBKeyRange
  ): Promise<number> {
    const store = await dbManager.getStore(storeName, 'readonly');
    const index = store.index(indexName);
    return new Promise((resolve, reject) => {
      const request = index.count(range);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error(`Failed to count by index range: ${request.error}`));
    });
  }

  /**
   * 游标遍历
   * 
   * @param storeName - 存储名称
   * @param callback - 回调函数，返回false停止遍历
   * @param indexName - 索引名称（可选）
   * @param range - 查询范围（可选）
   * @param direction - 遍历方向（可选）
   * @returns Promise<void>
   */
  static async cursor<T>(
    storeName: string,
    callback: (value: T, cursor: IDBCursorWithValue) => boolean | void,
    indexName?: string,
    range?: IDBKeyRange,
    direction?: IDBCursorDirection
  ): Promise<void> {
    const store = await dbManager.getStore(storeName, 'readonly');
    const source = indexName ? store.index(indexName) : store;
    const request = source.openCursor(range, direction);

    return new Promise((resolve, reject) => {
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result as IDBCursorWithValue;
        if (cursor) {
          const shouldContinue = callback(cursor.value, cursor);
          if (shouldContinue !== false) {
            cursor.continue();
            return;
          }
        }
        resolve();
      };
      request.onerror = () => reject(new Error(`Failed to cursor: ${request.error}`));
    });
  }
}
