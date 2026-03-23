import { getFollowedUPs } from "../../api/bili-api.js";
import {
  getValue
} from "../../database/implementations/settings-repository.impl.js";
import { CreatorRepository } from "../../database/implementations/creator-repository.impl.js";
import { ImageRepository } from "../../database/implementations/image-repository.impl.js";
import { Platform } from "../../database/types/base.js";
import type { Creator } from "../../database/types/creator.js";

declare const chrome: {
  runtime?: { getURL?: (path: string) => string };
  notifications?: { create: (options: { type: string; iconUrl: string; title: string; message: string }) => void };
};

// 创建共享的 repository 实例
const imageRepository = new ImageRepository();
const creatorRepository = new CreatorRepository(imageRepository);

export async function updateUpListTask(
  uid?: number
): Promise<{ success: boolean; newCount?: number }> {
  const notifications = chrome.notifications;

  const settings = (await getValue("settings")) as { userId?: number } | null;
  const uidValue = typeof uid === "number" ? uid : Number(uid ?? (await getValue("userId")) ?? settings?.userId);
  if (!uidValue || Number.isNaN(uidValue)) {
    console.warn("[Background] Missing userId for update");
    return { success: false };
  }

  // 获取本地已有的UP列表
  const existingCreators = await creatorRepository.getAllCreators(Platform.BILIBILI);
  const existingCreatorSet = new Set(existingCreators.map(c => c.creatorId));

  try {
    let page = 1;
    const pageSize = 50;
    let newCount = 0;
    let totalFetched = 0;
    const existingInBatchThreshold = 10; // 批次中存在10个已存储的UP时停止拉取

    // 分页获取关注列表
    while (true) {
      const result = await getFollowedUPs(uidValue, page, pageSize);

      // 验证返回的数据有效性
      if (!result || !result.upList || !Array.isArray(result.upList)) {
        console.error("[Background] Invalid UP list data received");
        return { success: false };
      }

      // 判断是否为增量更新：当前批次中至少10个已关注的UP
      const existingInBatch = result.upList.filter(up => existingCreatorSet.has(up.mid)).length;
      if (existingInBatch >= existingInBatchThreshold && page > 1) {
        console.log(`[Background] Page ${page}: Detected incremental update (${existingInBatch} existing UPs in batch, threshold=${existingInBatchThreshold})`);
        break;
      }

      // 将 FollowingUp 转换为 Creator
      const creators: Creator[] = result.upList.map(up => ({
        creatorId: up.mid,
        platform: Platform.BILIBILI,
        name: up.uname,
        avatar: '',
        avatarUrl: up.face,
        isLogout: 0,
        description: '',
        createdAt: Date.now(),
        followTime: Date.now(),
        isFollowing: 1,
        tagWeights: []
      }));

      // 统计新关注的UP
      const pageNewCount = creators.filter(c => !existingCreatorSet.has(c.creatorId)).length;
      newCount += pageNewCount;
      totalFetched += creators.length;

      // 批量保存创作者信息
      await creatorRepository.upsertCreators(creators);

      // 如果没有更多数据，停止拉取
      if (!result.hasMore) {
        break;
      }

      page++;
    }

    console.log("[Background] Updated UP list", totalFetched, "New UPs:", newCount);

    if (newCount > 0 && notifications) {
      notifications.create({
        type: "basic",
        iconUrl: chrome.runtime?.getURL?.("icons/icon128.png") || "",
        title: "关注更新",
        message: `发现 ${newCount} 个新关注的UP主！`
      });
    }

    return { success: true, newCount };
  } catch (error) {
    console.error("[Background] Error updating UP list:", error);
    // 更新失败时，本地已有的数据保持不变，不会影响stats界面的显示
    return { success: false };
  }
}
