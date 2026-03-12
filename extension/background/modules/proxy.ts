declare const chrome: {
  tabs?: {
    query?: (queryInfo: { url?: string }) => Promise<{ id?: number }[]>;
    sendMessage?: (tabId: number, message: unknown) => Promise<unknown>;
  };
};

export async function proxyApiRequest(url: string): Promise<unknown | null> {
  if (typeof chrome === "undefined" || !chrome.tabs?.query || !chrome.tabs?.sendMessage) {
    return null;
  }
  const tabs = await chrome.tabs.query({ url: "*://*.bilibili.com/*" });
  const candidates = tabs.filter((tab) => typeof tab.id === "number") as { id: number }[];
  if (candidates.length === 0) {
    console.warn("[Background] No Bilibili tab for proxy");
    return null;
  }
  for (const tab of candidates) {
    try {
      const response = (await chrome.tabs.sendMessage(tab.id, {
        type: "bili_api_request",
        url
      })) as { data?: unknown } | undefined;
      if (response && response.data !== undefined) {
        return response.data ?? null;
      }
    } catch (error) {
      console.warn("[Background] Proxy send failed", error);
    }
  }
  console.warn("[Background] No proxy response");
  return null;
}
