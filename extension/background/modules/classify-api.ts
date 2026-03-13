import { getUPInfo, getUPVideos, getUPVideosForClassification, getVideoTags } from "../../api/bili-api.js";
import { classifyUP } from "../../engine/classifier.js";
import { getValue, setValue, addTagsToLibrary, getUPManualTags, setUPManualTags, getTagLibrary } from "../../storage/storage.js";
import type { BackgroundOptions } from "./common-types.js";
import { proxyApiRequest } from "./proxy.js";

export async function classifyUpTask(
  options: BackgroundOptions = {}
): Promise<number> {
  const classifyUPFn = options.classifyUPFn ?? classifyUP;
  const getValueFn = options.getValueFn ?? ((key: string) => getValue(key));
  const setValueFn = options.setValueFn ?? ((key: string, value: unknown) => setValue(key, value));
  const batchSize = options.batchSize ?? 10;
  const useAPIMethod = options.useAPIMethod ?? false;
  const maxVideos = options.maxVideos ?? 30;

  const settings = (await getValueFn("settings")) as { classifyMethod?: "api" | "page" } | null;
  const classifyMethod = settings?.classifyMethod ?? "api";
  const shouldUseAPIMethod = useAPIMethod || classifyMethod === "api";

  const cache = (await getValueFn("upList")) as { upList?: { mid: number }[] } | null;
  const list = cache?.upList ?? [];
  if (list.length === 0) {
    console.log("[Background] No UPs to classify");
    return 0;
  }

  const videoCounts =
    ((await getValueFn("videoCounts")) as Record<string, number> | null) ?? {};
  const batch = list;
  let processed = 0;

  // 获取标签库
  const tagLibrary = await getTagLibrary({ storage: options.storage });

  console.log("[Background] Classify UPs using method:", shouldUseAPIMethod ? "API" : "Page");

  if (shouldUseAPIMethod && typeof chrome !== "undefined" && chrome.runtime) {
    chrome.runtime.sendMessage({
      type: "classify_progress",
      payload: { current: 0, total: list.length, text: "准备中..." }
    });
  }

  for (let i = 0; i < batch.length; i += batchSize) {
    const chunk = batch.slice(i, i + batchSize);
    for (const up of chunk) {
      // 获取UP的手动标签ID
      const existingTagIds = await getUPManualTags(up.mid, { storage: options.storage });
      
      // 将标签ID转换为标签名称
      const existingTagNames: string[] = [];
      for (const tagId of existingTagIds) {
        const tag = tagLibrary[tagId];
        if (tag?.name) {
          existingTagNames.push(tag.name);
        }
      }
      
      console.log("[Background] Classify UP", up.mid, {
        existingTags: existingTagNames.length
      });

      const profile = await classifyUPFn(up.mid, {
        existingTags: existingTagNames,
        useAPIMethod: shouldUseAPIMethod,
        maxVideos: maxVideos,
        getUPVideosFn: shouldUseAPIMethod
          ? (mid: number) => getUPVideosForClassification(mid, maxVideos, { fallbackRequest: proxyApiRequest })
          : (mid: number) => getUPVideos(mid, { fallbackRequest: proxyApiRequest }),
        getUPInfoFn: (mid: number) =>
          getUPInfo(mid, { fallbackRequest: proxyApiRequest }),
        getVideoTagsFn: (bvid: string) =>
          getVideoTags(bvid, { fallbackRequest: proxyApiRequest })
      });
      
      // 将标签名称添加到标签库，获取标签ID
      const addedTags = await addTagsToLibrary(profile.tags, { storage: options.storage });
      const tagIds = addedTags.map(tag => tag.id);
      
      // 保存UP的手动标签
      await setUPManualTags(up.mid, tagIds, { storage: options.storage });
      
      videoCounts[String(up.mid)] = profile.videoCount ?? 0;
      processed += 1;

      if (shouldUseAPIMethod && typeof chrome !== "undefined" && chrome.runtime) {
        chrome.runtime.sendMessage({
          type: "classify_progress",
          payload: {
            current: processed,
            total: list.length,
            text: `正在分类: ${up.mid}`
          }
        });
      }
    }
  }

  await setValueFn("videoCounts", videoCounts);
  await setValueFn("classifyStatus", { lastUpdate: Date.now() });
  console.log("[Background] Classified UPs", processed);

  if (shouldUseAPIMethod && typeof chrome !== "undefined" && chrome.runtime) {
    chrome.runtime.sendMessage({ type: "classify_complete" });
  }

  return processed;
}
