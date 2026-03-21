export interface ProgressPayload {
  current: number;
  total: number;
  text: string;
}

export function sendClassifyProgress(
  current: number,
  total: number,
  text: string
): void {
  if (typeof chrome !== "undefined" && chrome.runtime) {
    chrome.runtime.sendMessage({
      type: "classify_progress",
      payload: { current, total, text }
    });
  }
}

export function sendClassifyComplete(): void {
  if (typeof chrome !== "undefined" && chrome.runtime) {
    chrome.runtime.sendMessage({
      type: "classify_complete"
    });
  }
}
