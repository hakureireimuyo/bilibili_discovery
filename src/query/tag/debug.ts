/**
 * 标签查询模块调试工具
 * 用于诊断标签查询相关的问题
 * 使用Repository实现层访问数据
 */

import type { Tag } from '../../database/types/semantic.js';
import { TagRepository } from '../../database/implementations/tag-repository.impl.js';

// 创建Repository实例
const tagRepo = new TagRepository();

/**
 * 检查标签数据
 */
export async function debugTagData(tagId: string): Promise<void> {
  console.log(`[Debug] Checking tag data for ${tagId}`);

  const tag = await tagRepo.getTag(tagId);
  console.log('[Debug] Tag:', tag);
}

/**
 * 检查所有标签
 */
export async function debugAllTags(): Promise<void> {
  console.log('[Debug] Checking all tags...');

  const allTags = await tagRepo.getAllTags();
  console.log(`[Debug] Total tags: ${allTags.length}`);
  console.log('[Debug] Tags:', allTags);

  // 按来源分组统计
  const userTags = allTags.filter(tag => tag.source === 'user');
  const systemTags = allTags.filter(tag => tag.source === 'system');
  console.log(`[Debug] User tags: ${userTags.length}`);
  console.log('[Debug] User tags:', userTags);
  console.log(`[Debug] System tags: ${systemTags.length}`);
  console.log('[Debug] System tags:', systemTags);
}

/**
 * 搜索标签
 */
export async function debugSearchTags(keyword: string): Promise<void> {
  console.log(`[Debug] Searching tags with keyword: ${keyword}`);

  const allTags = await tagRepo.getAllTags();
  const lowerKeyword = keyword.toLowerCase();
  const matchedTags = allTags.filter(tag =>
    tag.name.toLowerCase().includes(lowerKeyword)
  );

  console.log(`[Debug] Found ${matchedTags.length} matching tags`);
  console.log('[Debug] Matched tags:', matchedTags);
}

/**
 * 运行完整诊断
 */
export async function runFullDiagnostics(): Promise<void> {
  console.log('[Debug] ===== Starting diagnostics =====');

  await debugAllTags();

  console.log('[Debug] ===== Diagnostics complete =====');
}

// 暴露到window对象以便在控制台调用
if (typeof window !== 'undefined') {
  (window as any).debugTagQuery = {
    debugTagData,
    debugAllTags,
    debugSearchTags,
    runFullDiagnostics
  };
  console.log('[Debug] Debug tools available at window.debugTagQuery');
}
