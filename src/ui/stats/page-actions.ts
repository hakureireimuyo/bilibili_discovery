
declare const chrome: {
  runtime: {
    sendMessage: (message: unknown, callback?: (response: unknown) => void) => void;
  };
};

export function bindPageActions(): void {
  const clearBtn = document.getElementById("btn-clear-classify");
  clearBtn?.addEventListener("click", () => {
    if (typeof chrome === "undefined") {
      return;
    }
    chrome.runtime.sendMessage({ type: "clear_classify_data" }, () => {
      window.location.reload();
    });
  });

  const updateUpListBtn = document.getElementById("btn-update-up-list");
  updateUpListBtn?.addEventListener("click", () => {
    if (typeof chrome === "undefined") {
      return;
    }
    chrome.runtime.sendMessage({ type: "update_up_list" }, () => {
      window.location.reload();
    });
  });

  const autoClassifyBtn = document.getElementById("btn-auto-classify");
  autoClassifyBtn?.addEventListener("click", () => {
    if (typeof chrome === "undefined") {
      return;
    }
    chrome.runtime.sendMessage({ type: "start_auto_classify" });
  });

  const probeBtn = document.getElementById("btn-probe-up");
  const probeInput = document.getElementById("probe-mid") as HTMLInputElement | null;
  const probeResult = document.getElementById("probe-result");
  probeBtn?.addEventListener("click", () => {
    if (typeof chrome === "undefined") {
      return;
    }
    const mid = Number(probeInput?.value ?? 0);
    if (!mid || Number.isNaN(mid)) {
      if (probeResult) {
        probeResult.textContent = "请输入有效 mid";
      }
      return;
    }
    chrome.runtime.sendMessage({ type: "probe_up", payload: { mid } }, (response: unknown) => {
      const result = response as { ok?: boolean; name?: string; videoCount?: number } | null;
      if (!probeResult) {
        return;
      }
      if (!result || !result.ok) {
        probeResult.textContent = "获取失败，请确认已打开任意 B 站页面并保持登录";
        return;
      }
      probeResult.textContent = `UP: ${result.name ?? "-"} | videos: ${result.videoCount ?? 0}`;
    });
  });
}
