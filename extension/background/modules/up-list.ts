import { getFollowedUPs } from "../../api/bili-api.js";
import { getValue, saveUPList, type UP } from "../../storage/storage.js";
import type { BackgroundOptions } from "./common-types.js";

declare const chrome: {
  runtime?: { getURL?: (path: string) => string };
  notifications?: { create: (options: { type: string; iconUrl: string; title: string; message: string }) => void };
};

export async function updateUpListTask(
  options: BackgroundOptions = {}
): Promise<{ success: boolean; newCount?: number }> {
  const getFollowedUPsFn = options.getFollowedUPsFn ?? getFollowedUPs;
  const saveUPListFn = options.saveUPListFn ?? saveUPList;
  const getValueFn = options.getValueFn ?? ((key: string) => getValue(key));
  const notifications = options.notifications ?? chrome.notifications;

  const settings = (await getValueFn("settings")) as { userId?: number } | null;
  const uid = options.uid ?? (await getValueFn("userId")) ?? settings?.userId;
  const uidValue = typeof uid === "number" ? uid : Number(uid);
  if (!uidValue || Number.isNaN(uidValue)) {
    console.warn("[Background] Missing userId for update");
    return { success: false };
  }

  // 获取本地已有的UP列表
  const existingCache = (await getValueFn("upList")) as { upList?: UP[] } | null;
  const existingUPs = existingCache?.upList ?? [];

  try {
    // 获取新的关注列表
    const result = await getFollowedUPsFn(uidValue, {}, existingUPs);

    // 验证返回的数据有效性
    if (!result || !result.upList || !Array.isArray(result.upList)) {
      console.error("[Background] Invalid UP list data received");
      return { success: false };
    }

    // 只有当获取到的数据有效时才保存
    await saveUPListFn(result.upList);
    console.log("[Background] Updated UP list", result.upList.length, "New UPs:", result.newCount);

    if (result.newCount > 0 && notifications) {
      notifications.create({
        type: "basic",
        iconUrl: chrome.runtime?.getURL?.("icons/icon128.png") || "",
        title: "关注更新",
        message: `发现 ${result.newCount} 个新关注的UP主！`
      });
    }

    return { success: true, newCount: result.newCount };
  } catch (error) {
    console.error("[Background] Error updating UP list:", error);
    // 更新失败时，本地已有的数据保持不变，不会影响stats界面的显示
    return { success: false };
  }
}
