import { navigateToWorkbench } from "./popup-progress.js";
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

function bindButtons(): void {
  document.getElementById("btn-open-workbench")?.addEventListener("click", () => {
    navigateToWorkbench();
  });
}

async function initPopupView(): Promise<void> {
  try {
    // 延迟一小段时间，让数据库有时间初始化
    await new Promise(resolve => setTimeout(resolve, 100));

    const { snapshot, partialFailure } = await loadSnapshotSafely();
    const widgets = buildWidgets(snapshot);

    renderWidgetGrid(widgets);

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
