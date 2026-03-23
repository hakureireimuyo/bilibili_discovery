import { formatSeconds } from "./utils.js";
import type { WatchStats } from "../../background/modules/types.js";
import type { UP } from "../../database/implementations/index.js";
import { getTagLibrary } from "../../database/implementations/index.js";
import { createTagPill } from "./tag-utils.js";

/**
 * 渲染简单的列表
 */
export function renderList(
  containerId: string,
  rows: Array<{ label: string; value: number }>
): void {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = "";
  if (rows.length === 0) {
    const item = document.createElement("div");
    item.className = "list-item";
    item.textContent = "暂无数据";
    container.appendChild(item);
    return;
  }
  for (const row of rows) {
    const item = document.createElement("div");
    item.className = "list-item";
    const label = document.createElement("span");
    label.textContent = row.label;
    const value = document.createElement("span");
    value.textContent = formatSeconds(row.value);
    item.appendChild(label);
    item.appendChild(value);
    container.appendChild(item);
  }
}

/**
 * 渲染键值对列表
 */
export function renderKeyValueList(
  containerId: string,
  rows: Array<{ label: string; value: string }>
): void {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = "";
  if (rows.length === 0) {
    const item = document.createElement("div");
    item.className = "list-item";
    item.textContent = "暂无数据";
    container.appendChild(item);
    return;
  }
  for (const row of rows) {
    const item = document.createElement("div");
    item.className = "list-item";
    const label = document.createElement("span");
    label.textContent = row.label;
    const value = document.createElement("span");
    value.textContent = row.value;
    item.appendChild(label);
    item.appendChild(value);
    container.appendChild(item);
  }
}

/**
 * 渲染标签列表
 */
export async function renderTagList(
  stats: WatchStats
): Promise<void> {
  const tagTotals: Record<string, number> = {};
  const tagVideoCounts: Record<string, number> = {};
  
  // 获取标签库，用于将标签ID转换为标签名称
  const tagLibrary = await getTagLibrary();

  for (const [videoKey, tagIds] of Object.entries(stats.videoTags)) {
    const seconds = stats.videoSeconds[videoKey] ?? 0;
    const upId = stats.videoUpIds[videoKey];
    const upKey = upId ? String(upId) : null;
    const upSeconds = upKey ? (stats.upSeconds[upKey] ?? 0) : 0;
    
    // 使用视频观看时长，如果没有则使用UP观看时长（作为近似值）
    const effectiveSeconds = seconds > 0 ? seconds : upSeconds;
    
    for (const tagId of tagIds || []) {
      const tag = tagLibrary[tagId];
      const tagName = tag ? tag.name : tagId;
      tagTotals[tagName] = (tagTotals[tagName] ?? 0) + effectiveSeconds;
      tagVideoCounts[tagName] = (tagVideoCounts[tagName] ?? 0) + 1;
    }
  }

  const tagRows = Object.entries(tagTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([tag, seconds]) => ({
      label: tag,
      value: seconds,
      extra: `视频: ${tagVideoCounts[tag] ?? 0}`
    }));

  const tagListContainer = document.getElementById("tag-list");
  if (tagListContainer) {
    tagListContainer.innerHTML = "";
    if (tagRows.length === 0) {
      const item = document.createElement("div");
      item.className = "list-item";
      item.textContent = "暂无数据";
      tagListContainer.appendChild(item);
    } else {
      for (const row of tagRows) {
        const item = document.createElement("div");
        item.className = "list-item";
        const label = document.createElement("span");
        label.appendChild(createTagPill(row.label));
        const valueContainer = document.createElement("span");
        valueContainer.style.display = "flex";
        valueContainer.style.gap = "12px";
        const value = document.createElement("span");
        value.textContent = formatSeconds(row.value);
        const extra = document.createElement("span");
        extra.textContent = row.extra;
        extra.style.color = "#6b7280";
        valueContainer.appendChild(value);
        valueContainer.appendChild(extra);
        item.appendChild(label);
        item.appendChild(valueContainer);
        tagListContainer.appendChild(item);
      }
    }
  }
}

/**
 * 渲染UP列表
 */
export function renderUPList(
  stats: WatchStats,
  upInfoMap: Map<number, UP>
): void {
  const upListContainer = document.getElementById("up-list");
  if (!upListContainer) return;

  upListContainer.innerHTML = "";
  const upRows = Object.entries(stats.upSeconds)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  if (upRows.length === 0) {
    const item = document.createElement("div");
    item.className = "list-item";
    item.textContent = "暂无数据";
    upListContainer.appendChild(item);
  } else {
    for (const [upIdStr, seconds] of upRows) {
      const upId = parseInt(upIdStr, 10);
      const upInfo = upInfoMap.get(upId);

      const item = document.createElement("div");
      item.className = "list-item clickable";
      item.style.cursor = "pointer";

      // 创建UP信息容器
      const upInfoContainer = document.createElement("div");
      upInfoContainer.style.display = "flex";
      upInfoContainer.style.alignItems = "center";
      upInfoContainer.style.gap = "12px";
      upInfoContainer.style.flex = "1";

      // 头像
      const avatar = document.createElement("img");
      avatar.className = "up-avatar";
      avatar.style.width = "32px";
      avatar.style.height = "32px";
      avatar.style.borderRadius = "50%";
      avatar.style.objectFit = "cover";

      // 如果本地有UP信息，使用本地头像和名字
      if (upInfo) {
        avatar.src = upInfo.face;
        avatar.onerror = () => {
          avatar.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23667eea'%3E%3Cpath d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/%3E%3C/svg%3E";
        };
      }

      // 名字和ID
      const nameContainer = document.createElement("div");
      nameContainer.style.display = "flex";
      nameContainer.style.flexDirection = "column";

      const name = document.createElement("span");
      name.textContent = upInfo ? upInfo.name : `UP ${upId}`;
      name.style.fontWeight = "500";

      nameContainer.appendChild(name);

      upInfoContainer.appendChild(avatar);
      upInfoContainer.appendChild(nameContainer);

      // 时长
      const duration = document.createElement("span");
      duration.textContent = formatSeconds(seconds);
      duration.style.fontWeight = "600";

      item.appendChild(upInfoContainer);
      item.appendChild(duration);

      // 点击跳转
      item.addEventListener("click", () => {
        window.open(`https://space.bilibili.com/${upId}`, "_blank");
      });

      upListContainer.appendChild(item);
    }
  }
}

/**
 * 渲染视频列表
 */
export function renderVideoList(stats: WatchStats): void {
  const videoListContainer = document.getElementById("video-list");
  if (!videoListContainer) return;

  videoListContainer.innerHTML = "";
  const videoRows = Object.entries(stats.videoSeconds)
    .sort((a, b) => {
      if (b[1] !== a[1]) {
        return b[1] - a[1];
      }
      const aCreatedAt = stats.videoCreatedAt?.[a[0]] ?? 0;
      const bCreatedAt = stats.videoCreatedAt?.[b[0]] ?? 0;
      return bCreatedAt - aCreatedAt;
    })
    .slice(0, 10);

  if (videoRows.length === 0) {
    const item = document.createElement("div");
    item.className = "list-item";
    item.textContent = "暂无数据";
    videoListContainer.appendChild(item);
  } else {
    for (const [bvid, seconds] of videoRows) {
      const item = document.createElement("div");
      item.className = "list-item clickable";
      item.style.cursor = "pointer";

      const title = document.createElement("span");
      title.textContent = stats.videoTitles[bvid] ?? bvid;
      title.style.flex = "1";

      const duration = document.createElement("span");
      duration.textContent = formatSeconds(seconds);
      duration.style.fontWeight = "600";

      item.appendChild(title);
      item.appendChild(duration);

      // 点击跳转
      item.addEventListener("click", () => {
        window.open(`https://www.bilibili.com/video/${bvid}`, "_blank");
      });

      videoListContainer.appendChild(item);
    }
  }
}
