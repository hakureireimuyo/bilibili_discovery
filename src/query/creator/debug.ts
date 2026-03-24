/**
 * 创作者查询模块调试工具
 * 用于诊断创作者查询相关的问题
 * 使用Repository实现层访问数据
 */

import type { Creator } from '../../database/types/creator.js';
import { Platform } from '../../database/types/base.js';
import { CreatorRepository } from '../../database/implementations/creator-repository.impl.js';

// 创建Repository实例
const creatorRepo = new CreatorRepository();

/**
 * 检查创作者数据
 */
export async function debugCreatorData(creatorId: string, platform: Platform): Promise<void> {
  console.log(`[Debug] Checking creator data for ${creatorId} on ${platform}`);

  const creator = await creatorRepo.getCreator(creatorId, platform);
  console.log('[Debug] Creator:', creator);

  if (creator) {
    console.log('[Debug] Tag weights:', creator.tagWeights);
  }
}

/**
 * 检查所有创作者
 */
export async function debugAllCreators(platform: Platform): Promise<void> {
  console.log(`[Debug] Checking all creators on ${platform}...`);

  const allCreators = await creatorRepo.getAllCreators(platform);
  console.log(`[Debug] Total creators: ${allCreators.length}`);
  console.log('[Debug] Creators:', allCreators);

  // 按关注状态分组统计
  const followedCreators = allCreators.filter(creator => creator.isFollowing);
  const unfollowedCreators = allCreators.filter(creator => !creator.isFollowing);
  console.log(`[Debug] Followed creators: ${followedCreators.length}`);
  console.log(`[Debug] Unfollowed creators: ${unfollowedCreators.length}`);

  // 统计标签使用情况
  const tagUsageMap = await creatorRepo.getTagUsageCounts(platform);
  console.log('[Debug] Tag usage counts:', tagUsageMap);
}

/**
 * 搜索创作者
 */
export async function debugSearchCreators(
  platform: Platform,
  keyword: string
): Promise<void> {
  console.log(`[Debug] Searching creators with keyword: ${keyword} on ${platform}`);

  const creators = await creatorRepo.searchCreatorsByFilter(platform, {
    keyword,
    page: 0,
    pageSize: 50
  });

  console.log(`[Debug] Found ${creators.length} matching creators`);
  console.log('[Debug] Matched creators:', creators);
}

/**
 * 检查标签使用情况
 */
export async function debugTagUsage(platform: Platform): Promise<void> {
  console.log(`[Debug] Checking tag usage on ${platform}...`);

  const tagUsageMap = await creatorRepo.getTagUsageCounts(platform);
  console.log('[Debug] Tag usage counts:', tagUsageMap);

  // 按使用次数排序
  const sortedTags = Array.from(tagUsageMap.entries())
    .sort((a, b) => b[1] - a[1]);

  console.log('[Debug] Top 10 most used tags:', sortedTags.slice(0, 10));
}

/**
 * 运行完整诊断
 */
export async function runFullDiagnostics(platform: Platform): Promise<void> {
  console.log('[Debug] ===== Starting diagnostics =====');

  await debugAllCreators(platform);
  await debugTagUsage(platform);

  console.log('[Debug] ===== Diagnostics complete =====');
}

// 暴露到window对象以便在控制台调用
if (typeof window !== 'undefined') {
  (window as any).debugCreatorQuery = {
    debugCreatorData,
    debugAllCreators,
    debugSearchCreators,
    debugTagUsage,
    runFullDiagnostics
  };
  console.log('[Debug] Debug tools available at window.debugCreatorQuery');
}
