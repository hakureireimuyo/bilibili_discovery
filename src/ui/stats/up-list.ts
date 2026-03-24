
import type { StatsState, UPCacheData } from "./types.js";
import { createDragGhost, getDragContext, removeDragGhost, setDragContext } from "./drag.js";
import { colorFromTag, findCategory, getInputValue, updateToggleLabel, creatorToCacheData } from "./helpers.js";
import { addTagToUp, removeTagFromUp, renderAutoTagPill, renderTagPill } from "./tag-manager.js";
import { searchCreators, getCreator, getAvatarUrl } from "../query/index.js";
import { imageLoader } from "../../utls/image-loader.js";

type RenderFn = () => void;

// 分页状态
interface PaginationState {
  currentPage: number;
  pageSize: number;
  totalPages: number;
  totalItems: number;
}

let paginationState: PaginationState = {
  currentPage: 0,
  pageSize: 50,
  totalPages: 0,
  totalItems: 0
};

/**
 * 从查询层获取过滤后的UP列表（带分页）
 */
async function fetchFilteredUpList(state: StatsState, page: number = 0): Promise<{
  items: UPCacheData[];
  total: number;
  totalPages: number;
}> {
  // 过滤器中存储的已经是标签 ID，无需转换
  const includeTagIds = state.filters.includeTags;
  const excludeTagIds = state.filters.excludeTags;

  console.log('[fetchFilteredUpList] 查询参数:', {
    platform: state.platform,
    isFollowing: state.showFollowedOnly,
    includeTags: includeTagIds,
    excludeTags: excludeTagIds,
    includeCategories: state.filters.includeCategories,
    excludeCategories: state.filters.excludeCategories,
    keyword: getInputValue("up-search"),
    page,
    pageSize: paginationState.pageSize
  });

  // 获取总数和分页数据
  const result = await searchCreators(state.platform, {
    isFollowing: state.showFollowedOnly,
    includeTags: includeTagIds,
    excludeTags: excludeTagIds,
    includeCategories: state.filters.includeCategories,
    excludeCategories: state.filters.excludeCategories,
    keyword: getInputValue("up-search"),
    page,
    pageSize: paginationState.pageSize
  });

  console.log('[fetchFilteredUpList] 总数:', result.total, '总页数:', result.totalPages);
  console.log('[fetchFilteredUpList] 当前页获取到的UP数量:', result.items.length);
  if (result.items.length > 0) {
    console.log('[fetchFilteredUpList] 第一个UP:', result.items[0]);
  }

  return result;
}

function setupUpTagDropZone(tagsEl: HTMLElement, creatorId: string, state: StatsState, rerender: RenderFn): void {
  tagsEl.addEventListener("dragover", (e) => {
    e.preventDefault();
    tagsEl.classList.add("drag-over");
  });
  tagsEl.addEventListener("dragleave", () => {
    tagsEl.classList.remove("drag-over");
  });
  tagsEl.addEventListener("drop", (e) => {
    e.preventDefault();
    tagsEl.classList.remove("drag-over");
    const tagData = e.dataTransfer?.getData("application/x-bili-tag") ?? e.dataTransfer?.getData("text/plain");
    if (!tagData) {
      return;
    }

    // 解析标签数据（可能是JSON字符串或纯文本）
    let tagName = tagData;
    try {
      const parsed = JSON.parse(tagData);
      if (parsed.tagName) {
        tagName = parsed.tagName;
      }
    } catch {
      // 如果解析失败，直接使用原始数据作为标签名
    }

    const currentDrag = getDragContext();
    if (currentDrag) {
      currentDrag.dropped = true;
    }
    void addTagToUp(state, creatorId, tagName, rerender);
  });
}

function renderUpTagPill(tagId: string, creatorId: string, state: StatsState, rerender: RenderFn): HTMLSpanElement {
  return renderTagPill(tagId, { creatorId, state, rerender });
}

async function buildTagContainer(state: StatsState, creatorId: string, rerender: RenderFn): Promise<HTMLElement> {
  const tags = document.createElement("div");
  tags.className = "up-tags";
  setupUpTagDropZone(tags, creatorId, state, rerender);

  // 首先尝试从缓存获取
  let upData = state.upCache[creatorId];

  // 如果缓存中没有，从查询层获取
  if (!upData) {
    const creator = await getCreator(creatorId, state.platform);
    if (creator) {
      const userTags = creator.tagWeights
        .filter(tw => tw.source === 'user')
        .map(tw => tw.tagId);

      upData = {
        ...creatorToCacheData(creator),
        tags: userTags
      };
      // 更新缓存
      state.upCache[creatorId] = upData;
      state.currentUpTags[creatorId] = userTags;
    }
  }

  if (!upData || upData.tags.length === 0) {
    tags.textContent = "暂无分类";
    return tags;
  }

  for (const tagId of upData.tags) {
    tags.appendChild(renderUpTagPill(tagId, creatorId, state, rerender));
  }
  return tags;
}

export function refreshUpList(state: StatsState, rerender: RenderFn): void {
  void renderUpList(state, rerender);
  updateToggleLabel(state.showFollowedOnly);
}

export async function renderUpList(state: StatsState, rerender: RenderFn): Promise<void> {
  const container = document.getElementById("up-list");
  if (!container) {
    return;
  }

  // 从查询层获取过滤后的UP列表
  const result = await fetchFilteredUpList(state, paginationState.currentPage);

  console.log('[renderUpList] 获取到的列表长度:', result.items.length);

  // 更新分页状态
  paginationState.totalItems = result.total;
  paginationState.totalPages = result.totalPages;

  // 更新缓存
  result.items.forEach(up => {
    state.upCache[up.creatorId] = up;
    state.currentUpTags[up.creatorId] = up.tags;
  });

  // 预加载头像图片
  void (async () => {
    const avatarIds = result.items
      .map(up => up.avatar)
      .filter((avatar): avatar is string => !!avatar);

    if (avatarIds.length > 0) {
      try {
        await imageLoader.preloadImages(avatarIds);
      } catch (error) {
        console.error('[up-list] Failed to preload avatar images:', error);
      }
    }
  })();

  if (result.items.length === 0) {
    console.log('[renderUpList] 列表为空，显示"暂无关注UP"');
    container.innerHTML = "";
    const item = document.createElement("div");
    item.className = "list-item";
    item.textContent = "暂无关注UP";
    container.appendChild(item);
    return;
  }

  // 清空容器
  container.innerHTML = "";

  // 渲染UP列表
  const fragment = document.createDocumentFragment();
  for (const up of result.items) {
    const item = document.createElement("div");
    item.className = "up-item";
    item.dataset.creatorId = up.creatorId;

    const avatarLink = document.createElement("a");
    avatarLink.href = `https://space.bilibili.com/${up.creatorId}`;
    avatarLink.target = "_blank";
    avatarLink.rel = "noreferrer";

    const avatar = document.createElement("img");
    avatar.className = "up-avatar";
    avatar.alt = up.name;

    // 优先使用avatar字段的图片数据（如base64），如果为空则使用avatarUrl
    if (up.avatar) {
      avatar.src = up.avatar;
    } else if (up.avatarUrl) {
      avatar.src = up.avatarUrl;
    } else {
      // 异步获取头像URL
      void (async () => {
        try {
          const avatarUrl = await getAvatarUrl(up.creatorId, state.platform);
          if (avatarUrl) {
            avatar.src = avatarUrl;
          }
        } catch (error) {
          console.error(`[up-list] Failed to fetch avatar URL for UP: ${up.name}`, error);
        }
      })();
    }

    avatarLink.appendChild(avatar);

    // 头像加载失败处理
    avatar.onerror = async () => {
      console.warn(`[up-list] Failed to load avatar for UP: ${up.name}`);

      // 如果有avatar字段，尝试使用ImageLoader加载
      if (up.avatar) {
        try {
          const result = await imageLoader.loadImage(up.avatar);
          avatar.src = result.data;
          return;
        } catch (error) {
          console.error(`[up-list] Failed to load avatar from cache for UP: ${up.name}`, error);
        }
      }

      // 尝试通过API获取头像URL
      try {
        const avatarUrl = await getAvatarUrl(up.creatorId, state.platform);
        if (avatarUrl) {
          avatar.src = avatarUrl;
        }
      } catch (error) {
        console.error(`[up-list] Failed to fetch avatar URL for UP: ${up.name}`, error);
      }
    };

    const info = document.createElement("div");
    info.className = "up-info";

    const name = document.createElement("a");
    name.className = "up-name";
    name.href = `https://space.bilibili.com/${up.creatorId}`;
    name.target = "_blank";
    name.rel = "noreferrer";
    name.textContent = up.name;

    info.appendChild(name);

    // 按需获取UP的标签数据
    const tagsContainer = document.createElement("div");
    tagsContainer.className = "up-tags";
    setupUpTagDropZone(tagsContainer, up.creatorId, state, rerender);

    // 异步加载标签数据
    void (async () => {
      const upData = state.upCache[up.creatorId];
      // 清空容器内容，而不是直接设置textContent，以保留事件监听器
      tagsContainer.innerHTML = "";
      if (!upData || upData.tags.length === 0) {
        const emptyText = document.createElement("span");
        emptyText.textContent = "暂无分类";
        tagsContainer.appendChild(emptyText);
      } else {
        for (const tagId of upData.tags) {
          tagsContainer.appendChild(renderUpTagPill(tagId, up.creatorId, state, rerender));
        }
      }
    })();

    info.appendChild(tagsContainer);
    item.appendChild(avatarLink);
    item.appendChild(info);
    fragment.appendChild(item);
  }

  container.appendChild(fragment);

  // 渲染分页控件
  renderPagination(container, result.total, paginationState.currentPage, paginationState.totalPages, rerender);

  // 预加载下一页的头像
  if (paginationState.currentPage < paginationState.totalPages - 1) {
    void (async () => {
      try {
        const nextPageResult = await fetchFilteredUpList(state, paginationState.currentPage + 1);
        const avatarIds = nextPageResult.items
          .map(up => up.avatar)
          .filter((avatar): avatar is string => !!avatar);

        if (avatarIds.length > 0) {
          await imageLoader.preloadImages(avatarIds);
        }
      } catch (error) {
        console.error('[up-list] Failed to preload next page avatars:', error);
      }
    })();
  }
}

/**
 * 渲染分页控件
 */
function renderPagination(
  container: HTMLElement,
  total: number,
  currentPage: number,
  totalPages: number,
  rerender: RenderFn
): void {
  // 移除旧的分页控件
  const oldPagination = container.querySelector('.pagination');
  if (oldPagination) {
    oldPagination.remove();
  }

  if (totalPages <= 1) {
    return;
  }

  const pagination = document.createElement('div');
  pagination.className = 'pagination';

  // 上一页按钮
  const prevBtn = document.createElement('button');
  prevBtn.className = 'pagination-btn';
  prevBtn.textContent = '上一页';
  prevBtn.disabled = currentPage === 0;
  prevBtn.onclick = () => {
    if (currentPage > 0) {
      paginationState.currentPage = currentPage - 1;
      rerender();
    }
  };
  pagination.appendChild(prevBtn);

  // 页码信息
  const pageInfo = document.createElement('span');
  pageInfo.className = 'pagination-info';
  pageInfo.textContent = `${currentPage + 1} / ${totalPages}`;
  pagination.appendChild(pageInfo);

  // 下一页按钮
  const nextBtn = document.createElement('button');
  nextBtn.className = 'pagination-btn';
  nextBtn.textContent = '下一页';
  nextBtn.disabled = currentPage >= totalPages - 1;
  nextBtn.onclick = () => {
    if (currentPage < totalPages - 1) {
      paginationState.currentPage = currentPage + 1;
      rerender();
    }
  };
  pagination.appendChild(nextBtn);

  container.appendChild(pagination);
}
