/**
 * URL 拼接工具
 * 提供统一的 B 站 URL 构建方法
 */

/**
 * 构建 B 站用户空间 URL
 * @param creatorId 用户 ID
 * @returns 用户空间 URL
 */
export function buildUserSpaceUrl(creatorId: string | number): string {
  return `https://space.bilibili.com/${creatorId}`;
}

/**
 * 构建 B 站搜索 URL
 * @param keyword 搜索关键词
 * @returns 搜索 URL
 */
export function buildSearchUrl(keyword: string): string {
  return `https://search.bilibili.com/all?keyword=${encodeURIComponent(keyword)}`;
}

/**
 * 构建 B 站视频详情页 URL
 * @param bvid 视频 BV 号
 * @returns 视频详情页 URL
 */
export function buildVideoUrl(bvid: string): string {
  return `https://www.bilibili.com/video/${bvid}`;
}

/**
 * 构建 B 站收藏夹 URL
 * @param mid 用户 ID
 * @param fid 收藏夹 ID
 * @returns 收藏夹 URL
 */
export function buildFavoriteUrl(mid: string | number, fid: string | number): string {
  return `https://space.bilibili.com/${mid}/favlist?fid=${fid}`;
}

/**
 * 构建 B 站合集 URL
 * @param seasonId 合集 ID
 * @returns 合集 URL
 */
export function buildSeasonUrl(seasonId: string | number): string {
  return `https://www.bilibili.com/medialist/play/${seasonId}`;
}

/**
 * 构建 B 站分区 URL
 * @param rid 分区 ID
 * @returns 分区 URL
 */
export function buildRegionUrl(rid: number): string {
  return `https://www.bilibili.com/v/kichiku/${rid}`;
}
