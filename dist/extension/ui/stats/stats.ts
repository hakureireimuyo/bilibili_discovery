/**
 * Stats page logic.
 */

import { getValue } from "../../storage/storage.js";

export interface InterestProfile {
  [tag: string]: { tag: string; score: number };
}

export interface UPCache {
  upList: { mid: number; name: string; face: string }[];
}

declare const chrome: {
  runtime: {
    sendMessage: (message: unknown, callback?: (response: unknown) => void) => void;
  };
};

function setText(id: string, value: string): void {
  const el = document.getElementById(id);
  if (el) {
    el.textContent = value;
  }
}

export function countVideoTotals(counts: Record<string, number>): number {
  return Object.values(counts).reduce((total, value) => total + (value ?? 0), 0);
}

export function countUpTags(upTags: Record<string, string[]>): number {
  return Object.values(upTags).reduce((total, tags) => total + (tags?.length ?? 0), 0);
}

export function buildInterestRows(profile: InterestProfile): { tag: string; score: number }[] {
  return Object.values(profile).sort((a, b) => b.score - a.score);
}

export function colorFromTag(tag: string): string {
  let hash = 0;
  for (let i = 0; i < tag.length; i += 1) {
    hash = (hash * 31 + tag.charCodeAt(i)) % 360;
  }
  const hue = Math.abs(hash) % 360;
  const sat = 70 + (Math.abs(hash * 7) % 21);
  const light = 70 + (Math.abs(hash * 13) % 11);
  return `hsl(${hue} ${sat}% ${light}%)`;
}

function renderTagPill(tag: string): HTMLSpanElement {
  const pill = document.createElement("span");
  pill.className = "tag-pill";
  pill.textContent = tag;
  pill.style.backgroundColor = colorFromTag(tag);
  return pill;
}

function renderTags(upTags: Record<string, string[]>): void {
  const container = document.getElementById("tag-list");
  if (!container) return;
  container.innerHTML = "";
  const tags = Object.values(upTags).flat();
  if (tags.length === 0) {
    const item = document.createElement("div");
    item.className = "list-item";
    item.textContent = "暂无分类词条";
    container.appendChild(item);
    return;
  }
  const counts: Record<string, number> = {};
  for (const tag of tags) {
    counts[tag] = (counts[tag] ?? 0) + 1;
  }
  const rows = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 50);
  for (const [tag, count] of rows) {
    const item = document.createElement("div");
    item.className = "list-item";
    const label = document.createElement("span");
    label.appendChild(renderTagPill(tag));
    const value = document.createElement("span");
    value.textContent = String(count);
    item.appendChild(label);
    item.appendChild(value);
    container.appendChild(item);
  }
}

function renderUpList(
  upList: UPCache["upList"],
  upTags: Record<string, string[]>
): void {
  const container = document.getElementById("up-list");
  if (!container) return;
  container.innerHTML = "";
  if (!upList || upList.length === 0) {
    const item = document.createElement("div");
    item.className = "list-item";
    item.textContent = "暂无关注UP";
    container.appendChild(item);
    return;
  }
  for (const up of upList) {
    const item = document.createElement("div");
    item.className = "up-item";
    const avatar = document.createElement("img");
    avatar.className = "up-avatar";
    avatar.src = up.face || "";
    avatar.alt = up.name;
    const info = document.createElement("div");
    info.className = "up-info";
    const name = document.createElement("a");
    name.className = "up-name";
    name.href = `https://space.bilibili.com/${up.mid}`;
    name.target = "_blank";
    name.rel = "noreferrer";
    name.textContent = up.name;
    const tags = document.createElement("div");
    tags.className = "up-tags";
    const tagList = upTags[String(up.mid)] ?? [];
    if (tagList.length === 0) {
      tags.textContent = "暂无分类";
    } else {
      for (const tag of tagList) {
        tags.appendChild(renderTagPill(tag));
      }
    }
    info.appendChild(name);
    info.appendChild(tags);
    item.appendChild(avatar);
    item.appendChild(info);
    container.appendChild(item);
  }
}

function renderInterests(rows: { tag: string; score: number }[]): void {
  const container = document.getElementById("interest-list");
  if (!container) return;
  container.innerHTML = "";
  if (rows.length === 0) {
    const item = document.createElement("div");
    item.className = "list-item";
    item.textContent = "暂无兴趣数据";
    container.appendChild(item);
    return;
  }
  for (const row of rows) {
    const item = document.createElement("div");
    item.className = "list-item";
    const label = document.createElement("span");
    label.textContent = row.tag;
    const value = document.createElement("span");
    value.textContent = row.score.toFixed(2);
    item.appendChild(label);
    item.appendChild(value);
    container.appendChild(item);
  }
}

export async function initStats(): Promise<void> {
  if (typeof document === "undefined") return;

  const clearBtn = document.getElementById("btn-clear-classify");
  clearBtn?.addEventListener("click", () => {
    if (typeof chrome === "undefined") return;
    chrome.runtime.sendMessage({ type: "clear_classify_data" }, () => {
      window.location.reload();
    });
  });

  const updateUpListBtn = document.getElementById("btn-update-up-list");
  updateUpListBtn?.addEventListener("click", () => {
    if (typeof chrome === "undefined") return;
    chrome.runtime.sendMessage({ type: "update_up_list" }, (response: unknown) => {
      console.log("[Stats] Update UP list response:", response);
      window.location.reload();
    });
  });

  const autoClassifyBtn = document.getElementById("btn-auto-classify");
  autoClassifyBtn?.addEventListener("click", () => {
    if (typeof chrome === "undefined") return;
    chrome.runtime.sendMessage({ type: "start_auto_classify" }, (response: unknown) => {
      console.log("[Stats] Start auto classify response:", response);
    });
  });

  const probeBtn = document.getElementById("btn-probe-up");
  const probeInput = document.getElementById("probe-mid") as HTMLInputElement | null;
  const probeResult = document.getElementById("probe-result");
  probeBtn?.addEventListener("click", () => {
    if (typeof chrome === "undefined") return;
    const mid = Number(probeInput?.value ?? 0);
    if (!mid || Number.isNaN(mid)) {
      if (probeResult) probeResult.textContent = "请输入有效 mid";
      return;
    }
    chrome.runtime.sendMessage(
      { type: "probe_up", payload: { mid } },
      (response: unknown) => {
      const result = response as
        | { ok?: boolean; name?: string; videoCount?: number }
        | null;
      if (!probeResult) return;
      if (!result || !result.ok) {
        probeResult.textContent =
          "获取失败，请确认已打开任意 B 站页面并保持登录";
        return;
      }
      probeResult.textContent = `UP: ${result.name ?? "-"} | videos: ${result.videoCount ?? 0}`;
      }
    );
  });

  const upCache = (await getValue<UPCache>("upList")) ?? { upList: [] };
  const upTags = (await getValue<Record<string, string[]>>("upTags")) ?? {};
  const videoCounts = (await getValue<Record<string, number>>("videoCounts")) ?? {};

  setText("stat-up-count", String(upCache.upList?.length ?? 0));
  setText("stat-tag-count", String(countUpTags(upTags)));
  setText("stat-video-count", String(countVideoTotals(videoCounts)));

  renderUpList(upCache.upList ?? [], upTags);
  renderTags(upTags);
}

if (typeof document !== "undefined") {
  void initStats();
}
