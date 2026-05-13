import { navigateToWorkbench } from "./popup-progress.js";
import { initThemedPage } from "../../themes/index.js";
import { readPopupSnapshot, type PopupSnapshot, type WidgetId } from "./popup-snapshot-store.js";

interface FocusWidget {
  id: WidgetId;
  label: string;
  icon: string;
  value: string;
  hint: string;
  accent: string;
}

interface LoadSnapshotResult {
  snapshot: PopupSnapshot;
  partialFailure: boolean;
}

function setText(id: string, value: string): void {
  const el = document.getElementById(id);
  if (el) {
    el.textContent = value;
  }
}

function formatDuration(totalSeconds: number): string {
  if (!totalSeconds) {
    return "0 分钟";
  }

  if (totalSeconds >= 3600) {
    const hours = totalSeconds / 3600;
    return `${hours >= 10 ? Math.round(hours) : hours.toFixed(1)} 小时`;
  }

  return `${Math.max(1, Math.round(totalSeconds / 60))} 分钟`;
}

function buildWidgets(snapshot: PopupSnapshot): FocusWidget[] {
  return [
    {
      id: "today",
      label: "今日观看",
      icon: "icon-today",
      value: formatDuration(snapshot.todayWatchDuration),
      hint: "今天累计观看时长",
      accent: "accent-coral"
    },
    {
      id: "week",
      label: "近 7 天",
      icon: "icon-week",
      value: formatDuration(snapshot.weeklyWatchDuration),
      hint: `活跃 ${snapshot.recentActiveDays} 天`,
      accent: "accent-blue"
    },
    {
      id: "following",
      label: "关注 UP",
      icon: "icon-following",
      value: `${snapshot.followingCount}`,
      hint: "已沉淀的重点创作者",
      accent: "accent-gold"
    },
    {
      id: "favorites",
      label: "收藏条目",
      icon: "icon-favorites",
      value: `${snapshot.favoriteCount}`,
      hint: "已加入收藏的内容",
      accent: "accent-pink"
    },
    {
      id: "tags",
      label: "标签词条",
      icon: "icon-tags",
      value: `${snapshot.tagCount}`,
      hint: "当前可用于观察的兴趣标签",
      accent: "accent-teal"
    },
    {
      id: "records",
      label: "观看记录",
      icon: "icon-records",
      value: `${snapshot.watchRecordCount}`,
      hint: "已归档的播放记录数",
      accent: "accent-violet"
    }
  ];
}

async function loadSnapshot(): Promise<LoadSnapshotResult> {
  const snapshot = await readPopupSnapshot();

  return {
    snapshot,
    partialFailure: snapshot.generatedAt === null
  };
}

async function loadSnapshotSafely(): Promise<LoadSnapshotResult> {
  try {
    const result = await loadSnapshot();
    const hasAnyData =
      result.snapshot.weeklyWatchDuration > 0 ||
      result.snapshot.followingCount > 0 ||
      result.snapshot.favoriteCount > 0 ||
      result.snapshot.tagCount > 0 ||
      result.snapshot.watchRecordCount > 0;

    return {
      snapshot: result.snapshot,
      partialFailure: result.partialFailure || (!hasAnyData && !result.snapshot.userId)
    };
  } catch (error) {
    console.error("[popup] Failed to load snapshot:", error);
    return {
      snapshot: await readPopupSnapshot(),
      partialFailure: true,
    };
  }
}

function renderWidgetGrid(widgets: FocusWidget[]): void {
  const container = document.getElementById("focus-grid");
  if (!container) {
    return;
  }

  container.innerHTML = widgets
    .map(
      (item) => `
        <article class="focus-card ${item.accent}">
          <div class="focus-card-head">
            <span class="focus-card-icon"><span class="popup-icon ${item.icon}"></span></span>
            <span class="focus-card-title">${item.label}</span>
          </div>
          <strong class="focus-card-value">${item.value}</strong>
          <span class="focus-card-hint">${item.hint}</span>
        </article>
      `
    )
    .join("");
}

function setHeroStatus(state: "loading" | "ready" | "error", text: string): void {
  const status = document.getElementById("hero-status");
  if (!status) {
    return;
  }

  status.className = `hero-status is-${state}`;
  status.setAttribute("aria-label", text);

  const icon = status.querySelector(".popup-icon");

  if (icon) {
    icon.className =
      state === "loading"
        ? "popup-icon icon-loading"
        : state === "error"
          ? "popup-icon icon-error"
          : "popup-icon icon-ready";
  }
}

function bindButtons(): void {
  document.getElementById("btn-open-workbench")?.addEventListener("click", () => {
    navigateToWorkbench();
  });
}

async function initPopupView(): Promise<void> {
  try {
    const { snapshot, partialFailure } = await loadSnapshotSafely();
    const widgets = buildWidgets(snapshot);

    renderWidgetGrid(widgets);

    if (partialFailure) {
      setHeroStatus("error", "后台正在整理数据，已先展示轻量快照");
    } else {
      setHeroStatus("ready", "观察窗口已整理完成");
    }
  } catch (error) {
    console.error("[popup] Failed to initialize:", error);
    setHeroStatus("error", "数据加载失败，请稍后重试");
  }
}

export function initPopup(): void {
  if (typeof document === "undefined") {
    return;
  }

  initThemedPage("popup");
  bindButtons();
  void initPopupView();
}

if (typeof document !== "undefined") {
  initPopup();
}
