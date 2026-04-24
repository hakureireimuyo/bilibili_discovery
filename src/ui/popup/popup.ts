import { navigateToOptions, navigateToWorkbench } from "./popup-progress.js";
import { initThemedPage } from "../../themes/index.js";
import {
  CollectionItemRepositoryImpl,
  CreatorRepositoryImpl,
  DailyWatchStatsRepositoryImpl,
  TagRepositoryImpl,
  WatchEventRepositoryImpl,
  getValue
} from "../../database/implementations/index.js";
import { Platform } from "../../database/types/base.js";

type WidgetId = "today" | "week" | "following" | "favorites" | "tags" | "records";

interface FocusWidget {
  id: WidgetId;
  label: string;
  icon: string;
  value: string;
  hint: string;
  accent: string;
}

interface PopupSnapshot {
  userId: number | null;
  todayWatchDuration: number;
  weeklyWatchDuration: number;
  followingCount: number;
  favoriteCount: number;
  tagCount: number;
  watchRecordCount: number;
  lastUpdateTime: number | null;
  recentActiveDays: number;
  focusCreators: string[];
}

interface LoadSnapshotResult {
  snapshot: PopupSnapshot;
  partialFailure: boolean;
}

const STORAGE_KEY = "popup-visible-widgets";
const DEFAULT_WIDGETS: WidgetId[] = ["today", "week", "following", "favorites"];

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

function formatTime(timestamp: number | null): string {
  if (!timestamp) {
    return "暂无记录";
  }

  const date = new Date(timestamp);
  return `${date.getMonth() + 1}/${date.getDate()} ${date
    .getHours()
    .toString()
    .padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
}

function getStoredWidgets(): WidgetId[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [...DEFAULT_WIDGETS];
    }

    const parsed = JSON.parse(raw) as WidgetId[];
    const sanitized = parsed.filter((item) =>
      ["today", "week", "following", "favorites", "tags", "records"].includes(item)
    ) as WidgetId[];

    return sanitized.length > 0 ? sanitized : [...DEFAULT_WIDGETS];
  } catch (error) {
    console.error("[popup] Failed to read widget preference:", error);
    return [...DEFAULT_WIDGETS];
  }
}

function saveWidgets(widgetIds: WidgetId[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(widgetIds));
  } catch (error) {
    console.error("[popup] Failed to save widget preference:", error);
  }
}

function buildWidgets(snapshot: PopupSnapshot): FocusWidget[] {
  return [
    {
      id: "today",
      label: "今日观看",
      icon: "fa-sun",
      value: formatDuration(snapshot.todayWatchDuration),
      hint: "今天累计观看时长",
      accent: "accent-coral"
    },
    {
      id: "week",
      label: "近 7 天",
      icon: "fa-chart-line",
      value: formatDuration(snapshot.weeklyWatchDuration),
      hint: `活跃 ${snapshot.recentActiveDays} 天`,
      accent: "accent-blue"
    },
    {
      id: "following",
      label: "关注 UP",
      icon: "fa-user-check",
      value: `${snapshot.followingCount}`,
      hint: "已沉淀的重点创作者",
      accent: "accent-gold"
    },
    {
      id: "favorites",
      label: "收藏条目",
      icon: "fa-heart",
      value: `${snapshot.favoriteCount}`,
      hint: "已加入收藏的内容",
      accent: "accent-pink"
    },
    {
      id: "tags",
      label: "标签词条",
      icon: "fa-tags",
      value: `${snapshot.tagCount}`,
      hint: "当前可用于观察的兴趣标签",
      accent: "accent-teal"
    },
    {
      id: "records",
      label: "观看记录",
      icon: "fa-clock-rotate-left",
      value: `${snapshot.watchRecordCount}`,
      hint: "已归档的播放记录数",
      accent: "accent-violet"
    }
  ];
}

async function loadSnapshot(): Promise<LoadSnapshotResult> {
  const creatorRepo = new CreatorRepositoryImpl();
  const dailyStatsRepo = new DailyWatchStatsRepositoryImpl();
  const collectionItemRepo = new CollectionItemRepositoryImpl();
  const watchEventRepo = new WatchEventRepositoryImpl();
  const tagRepo = new TagRepositoryImpl();

  const [settings, recentStats, followingCreators, favoriteItems, watchEvents, tagResult] = await Promise.allSettled([
    getValue<{ userId?: number }>("settings"),
    dailyStatsRepo.getRecentStats(Platform.BILIBILI, 7),
    creatorRepo.getFollowingCreators(Platform.BILIBILI),
    collectionItemRepo.getAllItems(),
    watchEventRepo.getAllWatchEvents(),
    tagRepo.getAllTags()
  ]);

  const settingsValue = settings.status === "fulfilled" ? settings.value : null;
  const recentStatsValue = recentStats.status === "fulfilled" ? recentStats.value : [];
  const followingCreatorsValue = followingCreators.status === "fulfilled" ? followingCreators.value : [];
  const favoriteItemsValue = favoriteItems.status === "fulfilled" ? favoriteItems.value : [];
  const watchEventsValue = watchEvents.status === "fulfilled" ? watchEvents.value : [];
  const tagResultValue = tagResult.status === "fulfilled" ? tagResult.value : { items: [], total: 0, page: 0, pageSize: 0, totalPages: 0 };

  const todayStats = recentStatsValue[0] ?? null;
  const lastUpdateTime = recentStatsValue.reduce<number | null>((latest, item) => {
    if (!latest || item.updateTime > latest) {
      return item.updateTime;
    }
    return latest;
  }, null);

  const focusCreators = [...followingCreatorsValue]
    .sort((left, right) => (right.followTime || 0) - (left.followTime || 0))
    .slice(0, 3)
    .map((item) => item.name)
    .filter(Boolean);

  return {
    snapshot: {
      userId: settingsValue?.userId ?? null,
      todayWatchDuration: todayStats?.totalWatchDuration ?? 0,
      weeklyWatchDuration: recentStatsValue.reduce((sum, item) => sum + item.totalWatchDuration, 0),
      followingCount: followingCreatorsValue.length,
      favoriteCount: favoriteItemsValue.length,
      tagCount: tagResultValue.total,
      watchRecordCount: watchEventsValue.length,
      lastUpdateTime,
      recentActiveDays: recentStatsValue.filter((item) => item.totalWatchCount > 0).length,
      focusCreators
    },
    partialFailure:
      settings.status === "rejected" ||
      recentStats.status === "rejected" ||
      followingCreators.status === "rejected" ||
      favoriteItems.status === "rejected" ||
      watchEvents.status === "rejected" ||
      tagResult.status === "rejected"
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
    // 如果是popup环境下的IndexedDB错误，返回空数据而不是抛出错误
    if (error instanceof Error && (error.message.includes("IndexedDB") || error.message.includes("database"))) {
      console.warn("[popup] Database not available in popup context, showing empty state");
      return {
        snapshot: {
          userId: null,
          todayWatchDuration: 0,
          weeklyWatchDuration: 0,
          followingCount: 0,
          favoriteCount: 0,
          tagCount: 0,
          watchRecordCount: 0,
          lastUpdateTime: null,
          recentActiveDays: 0,
          focusCreators: [],
        },
        partialFailure: true,
      };
    }
    // 其他错误仍然抛出
    throw error;
  }
}

function renderWidgetGrid(widgets: FocusWidget[], visibleIds: WidgetId[]): void {
  const container = document.getElementById("focus-grid");
  if (!container) {
    return;
  }

  const visibleSet = new Set(visibleIds);
  const cards = widgets.filter((item) => visibleSet.has(item.id));

  container.innerHTML = cards
    .map(
      (item) => `
        <article class="focus-card ${item.accent}">
          <div class="focus-card-head">
            <span class="focus-card-icon"><i class="fas ${item.icon}"></i></span>
            <span class="focus-card-title">${item.label}</span>
          </div>
          <strong class="focus-card-value">${item.value}</strong>
          <span class="focus-card-hint">${item.hint}</span>
        </article>
      `
    )
    .join("");
}

function renderSelector(widgets: FocusWidget[], visibleIds: WidgetId[]): void {
  const container = document.getElementById("widget-selector");
  if (!container) {
    return;
  }

  const visibleSet = new Set(visibleIds);
  container.innerHTML = widgets
    .map(
      (item) => `
        <button
          type="button"
          class="widget-chip${visibleSet.has(item.id) ? " is-active" : ""}"
          data-widget-id="${item.id}"
          aria-pressed="${visibleSet.has(item.id)}"
        >
          <i class="fas ${item.icon}"></i>
          <span>${item.label}</span>
        </button>
      `
    )
    .join("");
}

function renderHighlights(snapshot: PopupSnapshot): void {
  setText("status-user-id", snapshot.userId ? String(snapshot.userId) : "未设置");
  setText("status-last-update", formatTime(snapshot.lastUpdateTime));

  const summaryEl = document.getElementById("hero-summary");
  if (summaryEl) {
    summaryEl.textContent = snapshot.lastUpdateTime
      ? `最近 7 天累计 ${formatDuration(snapshot.weeklyWatchDuration)}，数据更新于 ${formatTime(snapshot.lastUpdateTime)}`
      : "还没有可展示的数据，先正常浏览或在设置里完成基础配置。";
  }

  const uidHintEl = document.getElementById("uid-hint");
  if (uidHintEl) {
    uidHintEl.textContent = snapshot.userId ? "已完成基础绑定" : "点击这里前往设置 UID";
  }

  const focusList = document.getElementById("focus-creators");
  if (focusList) {
    focusList.innerHTML = "";

    const entries = snapshot.focusCreators.length > 0 ? snapshot.focusCreators : ["还没有沉淀出重点关注对象"];
    entries.forEach((name, index) => {
      const item = document.createElement("li");
      item.className = "focus-person";
      item.innerHTML = `<span class="focus-rank">${index + 1}</span><span class="focus-name">${name}</span>`;
      focusList.appendChild(item);
    });
  }

  const healthEl = document.getElementById("data-health");
  if (healthEl) {
    const healthy = Boolean(snapshot.userId) && snapshot.watchRecordCount > 0;
    healthEl.textContent = healthy ? "观察视窗已就绪" : "还需要再积累一点数据";
    healthEl.classList.toggle("is-ready", healthy);
  }
}

function bindStatusLink(snapshot: PopupSnapshot): void {
  const userIdEl = document.getElementById("status-user-id");
  if (!userIdEl || snapshot.userId) {
    return;
  }

  userIdEl.classList.add("status-link");
  userIdEl.title = "点击前往设置";
  userIdEl.addEventListener("click", () => navigateToOptions());
}

function bindButtons(): void {
  document.getElementById("btn-open-workbench")?.addEventListener("click", () => {
    navigateToWorkbench();
  });
}

function setHeroStatus(state: "loading" | "ready" | "error", text: string): void {
  const status = document.getElementById("hero-status");
  if (!status) {
    return;
  }

  status.className = `hero-status is-${state}`;

  const icon = status.querySelector("i");
  const label = status.querySelector("span");

  if (icon) {
    icon.className =
      state === "loading"
        ? "fas fa-circle-notch fa-spin"
        : state === "error"
          ? "fas fa-triangle-exclamation"
          : "fas fa-circle-check";
  }

  if (label) {
    label.textContent = text;
  }
}

function bindWidgetSelector(allWidgets: FocusWidget[], initialVisibleIds: WidgetId[]): void {
  let visibleIds = [...initialVisibleIds];

  renderSelector(allWidgets, visibleIds);
  renderWidgetGrid(allWidgets, visibleIds);

  document.getElementById("widget-selector")?.addEventListener("click", (event) => {
    const target = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-widget-id]");
    if (!target) {
      return;
    }

    const widgetId = target.dataset.widgetId as WidgetId | undefined;
    if (!widgetId) {
      return;
    }

    const exists = visibleIds.includes(widgetId);
    if (exists && visibleIds.length === 1) {
      return;
    }

    visibleIds = exists
      ? visibleIds.filter((item) => item !== widgetId)
      : [...visibleIds, widgetId];

    saveWidgets(visibleIds);
    renderSelector(allWidgets, visibleIds);
    renderWidgetGrid(allWidgets, visibleIds);
  });
}

async function initPopupView(): Promise<void> {
  try {
    // 延迟一小段时间，让数据库有时间初始化
    await new Promise(resolve => setTimeout(resolve, 100));

    const { snapshot, partialFailure } = await loadSnapshotSafely();
    const widgets = buildWidgets(snapshot);
    const visibleWidgets = getStoredWidgets();

    renderHighlights(snapshot);
    bindStatusLink(snapshot);
    bindWidgetSelector(widgets, visibleWidgets);

    if (partialFailure) {
      setHeroStatus("error", "部分数据暂时不可用，已展示当前可读取内容");
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
