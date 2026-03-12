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

  const existingCache = (await getValueFn("upList")) as { upList?: UP[] } | null;
  const existingUPs = existingCache?.upList ?? [];

  const result = await getFollowedUPsFn(uidValue, {}, existingUPs);

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
}
