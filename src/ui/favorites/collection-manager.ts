import type { Collection } from "../../database/types/collection.js";
import type { FavoritesState } from "./types.js";
import { updateFilterOptions } from "./filter-manager.js";
import { buildVideoIndex, executeQuery, getVideos } from "../../query/video/index.js";
import { getAllCollections } from "../../query/collection/index.js";
import { getTagsByIds } from "../../query/tag/index.js";

type RefreshFn = () => void;

export async function loadCollections(state: FavoritesState): Promise<void> {
  try {
    // 通过查询层获取收藏夹数据
    const result = await getAllCollections();
    state.collections = result.data || [];
    console.log('[Favorites] Loaded collections:', state.collections.length);
  } catch (error) {
    console.error('[Favorites] Error loading collections:', error);
    state.collections = [];
  }
}

export function renderCollectionTabs(state: FavoritesState, onSwitch: (collectionId: string) => void, onTypeSwitch: (type: 'user' | 'subscription') => void): void {
  const collectionTabs = document.getElementById('collectionTabs');
  if (!collectionTabs) return;

  collectionTabs.innerHTML = '';

  // 创建类型切换按钮容器
  const typeSwitchContainer = document.createElement('div');
  typeSwitchContainer.className = 'collection-type-switch';

  // 用户收藏夹按钮
  const userTypeBtn = document.createElement('button');
  userTypeBtn.className = `type-switch-btn ${state.currentCollectionType === 'user' ? 'active' : ''}`;
  userTypeBtn.textContent = '我的收藏夹';
  userTypeBtn.addEventListener('click', () => {
    if (state.currentCollectionType !== 'user') {
      onTypeSwitch('user');
    }
  });
  typeSwitchContainer.appendChild(userTypeBtn);

  // 订阅收藏夹按钮
  const subscriptionTypeBtn = document.createElement('button');
  subscriptionTypeBtn.className = `type-switch-btn ${state.currentCollectionType === 'subscription' ? 'active' : ''}`;
  subscriptionTypeBtn.textContent = '订阅的合集';
  subscriptionTypeBtn.addEventListener('click', () => {
    if (state.currentCollectionType !== 'subscription') {
      onTypeSwitch('subscription');
    }
  });
  typeSwitchContainer.appendChild(subscriptionTypeBtn);

  collectionTabs.appendChild(typeSwitchContainer);

  // 根据当前类型过滤收藏夹
  const filteredCollections = state.collections.filter(
    collection => collection.type === state.currentCollectionType ||
                  (collection.type === undefined && state.currentCollectionType === 'user')
  );

  if (filteredCollections.length === 0) {
    const emptyMessage = document.createElement('p');
    emptyMessage.className = 'empty-collections';
    emptyMessage.textContent = '暂无收藏夹';
    collectionTabs.appendChild(emptyMessage);
    return;
  }

  // 添加"全部"选项
  const allTab = document.createElement('div');
  allTab.className = `collection-tab ${state.currentCollectionId === 'all' ? 'active' : ''}`;
  allTab.dataset.collectionId = 'all';
  allTab.textContent = '全部';
  allTab.addEventListener('click', () => {
    onSwitch('all');
  });
  collectionTabs.appendChild(allTab);

  filteredCollections.forEach(collection => {
    const tab = document.createElement('div');
    tab.className = `collection-tab ${collection.collectionId === state.currentCollectionId ? 'active' : ''}`;
    tab.dataset.collectionId = collection.collectionId;
    tab.textContent = collection.name;
    tab.addEventListener('click', () => {
      if (collection.collectionId) {
        onSwitch(collection.collectionId);
      }
    });
    collectionTabs.appendChild(tab);
  });
}

export function showEmptyCollections(): void {
  const collectionTabs = document.getElementById('collectionTabs');
  if (collectionTabs) {
    collectionTabs.innerHTML = '<p class="empty-collections">暂无收藏夹</p>';
  }
}

export async function switchCollection(state: FavoritesState, collectionId: string, refresh: RefreshFn): Promise<void> {
  if (state.currentCollectionId === collectionId) return;

  state.currentCollectionId = collectionId;
  state.currentPage = 0;

  // 清除标签过滤
  state.filters.includeTags = [];
  state.filters.excludeTags = [];

  // 加载新收藏夹的数据
  await loadCollectionData(state);

  // 更新标签列表
  await updateFilterOptions(state);

  renderCollectionTabs(state, async (id) => {
    await switchCollection(state, id, refresh);
  }, async (type) => {
    await switchCollectionType(state, type, refresh);
  });
  await refresh();
}

export async function switchCollectionType(state: FavoritesState, type: 'user' | 'subscription', refresh: RefreshFn): Promise<void> {
  if (state.currentCollectionType === type) return;

  state.currentCollectionType = type;
  state.currentCollectionId = 'all';
  state.currentPage = 0;

  // 清除标签过滤
  state.filters.includeTags = [];
  state.filters.excludeTags = [];

  // 加载新类型的全部收藏夹数据
  await loadCollectionData(state);

  // 更新标签列表
  await updateFilterOptions(state);

  renderCollectionTabs(state, async (id) => {
    await switchCollection(state, id, refresh);
  }, async (newType) => {
    await switchCollectionType(state, newType, refresh);
  });
  await refresh();
}

export async function loadCollectionData(state: FavoritesState): Promise<void> {
  if (!state.currentCollectionId) {
    console.warn('[Favorites] No current collection ID');
    state.aggregatedVideos = [];
    state.filteredVideos = [];
    state.total = 0;
    return;
  }

  console.log('[Favorites] Loading collection data for:', state.currentCollectionId);

  try {
    // 构建视频索引
    await buildVideoIndex(state.currentCollectionId, state.currentCollectionType);

    // 执行查询
    const result = await executeQuery({
      page: state.currentPage,
      pageSize: state.pageSize,
      keyword: state.filters.keyword,
      includeTags: state.filters.includeTags,
      excludeTags: state.filters.excludeTags,
      collectionId: state.currentCollectionId,
      collectionType: state.currentCollectionType
    });

    console.log('[Favorites] Query result:', result);

    // 获取视频数据
    // executeQuery 返回的是 QueryResult<Video>，data 字段包含视频数据
    const videos = result.data;

    // 批量获取标签名称
    const allTagIds = Array.from(new Set(videos.flatMap(v => v.tags)));
    const tags = await getTagsByIds(allTagIds);

    // 转换为 AggregatedCollectionVideo 格式
    state.aggregatedVideos = videos.map(video => {
      const creatorName = video.creatorId; // 创作者名称可后续通过查询层获取
      return {
        videoId: video.videoId,
        title: video.title,
        description: video.description,
        duration: video.duration,
        creatorId: video.creatorId,
        creatorName,
        tags: video.tags,
        addedAt: 0,
        picture: video.picture,
        coverUrl: video.coverUrl
      };
    });

    state.filteredVideos = state.aggregatedVideos;
    state.total = result.total || 0;

    console.log('[Favorites] Loaded videos:', state.aggregatedVideos.length, 'total:', state.total);
    console.log('[Favorites] Aggregated videos:', state.aggregatedVideos);
  } catch (error) {
    console.error('[Favorites] Error loading collection data:', error);
    state.aggregatedVideos = [];
    state.filteredVideos = [];
    state.total = 0;
  }
}
