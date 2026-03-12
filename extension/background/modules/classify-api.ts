import { getUPInfo, getUPVideos, getUPVideosForClassification, getVideoTags } from "../../api/bili-api.js";
import { classifyUP } from "../../engine/classifier.js";
import { getValue, setValue } from "../../storage/storage.js";
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

  const upTags =
    ((await getValueFn("upTags")) as Record<string, string[]> | null) ?? {};
  const videoCounts =
    ((await getValueFn("videoCounts")) as Record<string, number> | null) ?? {};
  const batch = list;
  let processed = 0;

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
      const existing = upTags[String(up.mid)] ?? [];
      console.log("[Background] Classify UP", up.mid, {
        existingTags: existing.length
      });

      const profile = await classifyUPFn(up.mid, {
        existingTags: existing,
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
      upTags[String(up.mid)] = profile.tags;
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

  await setValueFn("upTags", upTags);
  await setValueFn("videoCounts", videoCounts);
  await setValueFn("classifyStatus", { lastUpdate: Date.now() });
  console.log("[Background] Classified UPs", processed);

  if (shouldUseAPIMethod && typeof chrome !== "undefined" && chrome.runtime) {
    chrome.runtime.sendMessage({ type: "classify_complete" });
  }

  return processed;
}
