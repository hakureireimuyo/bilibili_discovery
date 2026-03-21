import type { FavoritesState, AggregatedVideo } from "./types.js";
import { formatDuration, colorFromTag } from "./helpers.js";

type RefreshFn = () => void;

export function createVideoCard(video: AggregatedVideo): HTMLElement {
  const card = document.createElement('div');
  card.className = 'video-card';

  // 封面
  const cover = document.createElement('div');
  cover.className = 'video-cover';
  const img = document.createElement('img');
  img.src = video.coverUrl || '';
  img.alt = video.title;
  cover.appendChild(img);
  card.appendChild(cover);

  // 信息
  const info = document.createElement('div');
  info.className = 'video-info';

  // 标题
  const title = document.createElement('div');
  title.className = 'video-title';
  title.textContent = video.title;
  info.appendChild(title);

  // 描述
  const desc = document.createElement('div');
  desc.className = 'video-description';
  desc.textContent = video.description.substring(0, 100) + (video.description.length > 100 ? '...' : '');
  info.appendChild(desc);

  // 元数据
  const meta = document.createElement('div');
  meta.className = 'video-meta';
  meta.textContent = `创作者: ${video.creatorId} | 时长: ${formatDuration(video.duration)}`;
  info.appendChild(meta);

  // 标签
  if (video.tags && video.tags.length > 0) {
    const tags = document.createElement('div');
    tags.className = 'video-tags';
    video.tags.slice(0, 3).forEach(tagId => {
      const tag = document.createElement('span');
      tag.className = 'video-tag tag-pill';
      tag.textContent = tagId;
      tag.style.backgroundColor = colorFromTag(tagId);
      tag.draggable = true;

      // 拖拽事件
      tag.addEventListener("dragstart", (e) => {
        if (e.dataTransfer) {
          e.dataTransfer.setData("application/x-bili-tag", tagId);
          e.dataTransfer.effectAllowed = "copy";
        }
      });

      tags.appendChild(tag);
    });
    info.appendChild(tags);
  }

  card.appendChild(info);

  return card;
}

export function renderVideos(state: FavoritesState, elements: Record<string, HTMLElement | null>): void {
  if (elements.videoList) {
    elements.videoList.innerHTML = '';
  }

  // 计算当前页的视频
  const start = state.currentPage * state.pageSize;
  const end = start + state.pageSize;
  const pageVideos = state.filteredVideos.slice(start, end);

  if (pageVideos.length === 0) {
    if (elements.empty) elements.empty.style.display = 'block';
    if (elements.pagination) elements.pagination.style.display = 'none';
    return;
  }

  if (elements.empty) elements.empty.style.display = 'none';

  // 渲染视频卡片
  pageVideos.forEach(video => {
    const card = createVideoCard(video);
    elements.videoList?.appendChild(card);
  });
}

export function changePage(state: FavoritesState, delta: number, refresh: RefreshFn): void {
  const total = state.filteredVideos.length;
  const totalPages = Math.ceil(total / state.pageSize);
  const newPage = state.currentPage + delta;

  if (newPage < 0 || newPage >= totalPages) return;

  state.currentPage = newPage;
  refresh();
}
