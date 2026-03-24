/**
 * 查询执行器
 * 负责执行查询并处理结果
 */

import type { QueryParams, QueryResult, QueryOptions } from '../types.js';
import { QueryError } from '../types.js';

/**
 * 查询执行器
 * 负责执行查询并处理结果
 */
export class QueryExecutor {
  /**
   * 执行查询
   * @param queryFn 查询函数
   * @param params 查询参数
   * @param options 查询选项
   * @returns 查询结果
   */
  async execute<T>(
    queryFn: (params: QueryParams) => Promise<T[]>,
    params: QueryParams,
    options: QueryOptions = {}
  ): Promise<QueryResult<T>> {
    const startTime = Date.now();

    try {
      // 执行查询
      const data = await queryFn(params);

      // 计算分页信息
      const page = params.page || 0;
      const pageSize = params.pageSize || 10;
      const total = data.length;
      const totalPages = Math.ceil(total / pageSize);

      // 应用分页
      const startIndex = page * pageSize;
      const endIndex = startIndex + pageSize;
      const pageData = data.slice(startIndex, endIndex);

      const duration = Date.now() - startTime;
      console.log(`[QueryExecutor] Query executed in ${duration}ms`);

      return {
        data: pageData,
        total,
        page,
        pageSize,
        hasNext: page < totalPages - 1,
        hasPrev: page > 0
      };
    } catch (error) {
      console.error('[QueryExecutor] Query execution error:', error);
      throw new QueryError('查询执行失败', error as Error);
    }
  }

  /**
   * 批量执行查询
   * @param queryFns 查询函数数组
   * @param params 查询参数数组
   * @param options 查询选项
   * @returns 查询结果数组
   */
  async executeBatch<T>(
    queryFns: Array<(params: QueryParams) => Promise<T[]>>,
    params: QueryParams[],
    options: QueryOptions = {}
  ): Promise<QueryResult<T>[]> {
    if (queryFns.length !== params.length) {
      throw new QueryError('查询函数和参数数量不匹配');
    }

    const startTime = Date.now();

    try {
      const promises = queryFns.map((fn, index) => 
        this.execute(fn, params[index], options)
      );

      const results = await Promise.all(promises);

      const duration = Date.now() - startTime;
      console.log(`[QueryExecutor] Batch queries executed in ${duration}ms`);

      return results;
    } catch (error) {
      console.error('[QueryExecutor] Batch query execution error:', error);
      throw new QueryError('批量查询执行失败', error as Error);
    }
  }
}

// 导出单例实例
export const queryExecutor = new QueryExecutor();
