/**
 * Storage helpers based on chrome.storage.local.
 */

export interface StorageArea {
  get: (keys?: string | string[] | Record<string, unknown>) => Promise<Record<string, unknown>>;
  set: (items: Record<string, unknown>) => Promise<void>;
}

export interface StorageProvider {
  local: StorageArea;
}

/**
 * UP信息，包含基础信息和关注状态
 */
export interface UP {
  mid: number;
  name: string;
  face: string; // 头像URL
  face_data?: string; // 头像图片数据(base64)
  sign: string;
  follow_time: number;
  is_followed: boolean; // 是否已关注
}

/**
 * 视频信息，标签基于标签库
 */
export interface Video {
  bvid: string;
  aid: number;
  title: string;
  play: number;
  duration: number;
  pubdate: number;
  tags: string[]; // 标签ID列表，引用自标签库
}

/**
 * UP缓存
 */
export interface UPCache {
  upList: UP[];
  lastUpdate: number;
}

/**
 * UP头像图片数据缓存条目
 */
export interface UPFaceDataCacheEntry {
  mid: number; // UP的mid
  face_data: string; // 头像图片数据(base64)
  lastUpdate: number; // 最后更新时间
}

/**
 * UP头像图片数据缓存，键为UP的mid
 */
export type UPFaceDataCache = Record<string, UPFaceDataCacheEntry>;

/**
 * 视频缓存条目
 */
export interface VideoCacheEntry {
  videos: Video[];
  lastUpdate: number;
}

/**
 * 视频缓存，键为UP的mid
 */
export type VideoCache = Record<string, VideoCacheEntry>;

/**
 * 用户兴趣
 */
export interface UserInterest {
  tag: string;
  score: number;
}

/**
 * 用户兴趣档案
 */
export type InterestProfile = Record<string, UserInterest>;

/**
 * 标签库中的标签
 */
export interface Tag {
  id: string; // 标签唯一标识
  name: string; // 标签名称
  created_at: number; // 创建时间
}

/**
 * 标签库
 */
export type TagLibrary = Record<string, Tag>;

/**
 * UP-标签权重关联
 */
export interface UPTagWeight {
  tag_id: string; // 标签ID
  weight: number; // 权重
}

/**
 * UP的标签权重列表
 */
export interface UPTagWeights {
  mid: number; // UP的mid
  tags: UPTagWeight[]; // 标签权重列表
  lastUpdate: number; // 最后更新时间
}

/**
 * UP-标签权重缓存，键为UP的mid
 */
export type UPTagWeightsCache = Record<string, UPTagWeights>;

/**
 * UP的手动标签关联
 */
export interface UPManualTag {
  mid: number; // UP的mid
  tag_ids: string[]; // 标签ID列表
  lastUpdate: number; // 最后更新时间
}

/**
 * UP手动标签缓存，键为UP的mid
 */
export type UPManualTagsCache = Record<string, UPManualTag>;

/**
 * 大分区（标签聚合）
 */
export interface Category {
  id: string; // 分区ID
  name: string; // 分区名称
  tag_ids: string[]; // 包含的标签ID列表
  created_at: number; // 创建时间
}

/**
 * 大分区列表
 */
export type CategoryLibrary = Record<string, Category>;

interface StorageOptions {
  storage?: StorageProvider;
}

function getDefaultStorage(): StorageProvider {
  return chrome.storage as StorageProvider;
}

declare const chrome: { storage: StorageProvider };

/**
 * Set a value in storage.
 */
export async function setValue<T>(
  key: string,
  value: T,
  options: StorageOptions = {}
): Promise<void> {
  const storage = options.storage ?? getDefaultStorage();
  console.log("[Storage] Set", key);
  await storage.local.set({ [key]: value });
}

/**
 * Get a value from storage.
 */
export async function getValue<T>(
  key: string,
  options: StorageOptions = {}
): Promise<T | null> {
  const storage = options.storage ?? getDefaultStorage();
  const result = await storage.local.get(key);
  const value = result[key] as T | undefined;
  return value ?? null;
}

// ==================== 标签库操作 ====================

/**
 * 获取标签库
 */
export async function getTagLibrary(
  options: StorageOptions = {}
): Promise<TagLibrary> {
  return (await getValue<TagLibrary>("tagLibrary", options)) ?? {};
}

/**
 * 保存标签库
 */
export async function saveTagLibrary(
  library: TagLibrary,
  options: StorageOptions = {}
): Promise<void> {
  await setValue("tagLibrary", library, options);
}

/**
 * 添加标签到标签库
 */
export async function addTagToLibrary(
  name: string,
  options: StorageOptions = {}
): Promise<Tag> {
  const library = await getTagLibrary(options);
  // 检查是否已存在相同名称的标签
  const existingTag = Object.values(library).find(tag => tag.name === name);
  if (existingTag) {
    return existingTag;
  }
  
  // 生成标签ID（使用名称的哈希值）
  const id = `tag_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const tag: Tag = {
    id,
    name,
    created_at: Date.now()
  };
  
  library[id] = tag;
  await saveTagLibrary(library, options);
  return tag;
}

/**
 * 根据ID获取标签
 */
export async function getTagById(
  id: string,
  options: StorageOptions = {}
): Promise<Tag | null> {
  const library = await getTagLibrary(options);
  return library[id] ?? null;
}

/**
 * 根据名称获取标签ID
 */
export async function getTagIdByName(
  name: string,
  options: StorageOptions = {}
): Promise<string | null> {
  const library = await getTagLibrary(options);
  const tag = Object.values(library).find(t => t.name === name);
  return tag?.id ?? null;
}

/**
 * 批量添加标签到标签库
 */
export async function addTagsToLibrary(
  names: string[],
  options: StorageOptions = {}
): Promise<Tag[]> {
  const library = await getTagLibrary(options);
  const addedTags: Tag[] = [];
  
  for (const name of names) {
    // 检查是否已存在
    const existingTag = Object.values(library).find(tag => tag.name === name);
    if (existingTag) {
      addedTags.push(existingTag);
      continue;
    }
    
    // 创建新标签
    const id = `tag_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const tag: Tag = {
      id,
      name,
      created_at: Date.now()
    };
    
    library[id] = tag;
    addedTags.push(tag);
  }
  
  await saveTagLibrary(library, options);
  return addedTags;
}

// ==================== UP-标签权重操作 ====================

/**
 * 获取UP的标签权重列表
 */
export async function getUPTagWeights(
  mid: number,
  options: StorageOptions = {}
): Promise<UPTagWeights | null> {
  const cache = (await getValue<UPTagWeightsCache>("upTagWeightsCache", options)) ?? {};
  return cache[String(mid)] ?? null;
}

/**
 * 更新UP的标签权重
 */
export async function updateUPTagWeights(
  mid: number,
  tagIds: string[],
  options: StorageOptions = {}
): Promise<void> {
  const cache = (await getValue<UPTagWeightsCache>("upTagWeightsCache", options)) ?? {};
  const midKey = String(mid);
  
  // 获取现有标签权重
  const existingWeights = cache[midKey] ?? { mid, tags: [], lastUpdate: 0 };
  const existingTagsMap = new Map(existingWeights.tags.map(t => [t.tag_id, t.weight]));
  
  // 更新标签权重
  for (const tagId of tagIds) {
    const currentWeight = existingTagsMap.get(tagId) ?? 0;
    existingTagsMap.set(tagId, currentWeight + 1);
  }
  
  // 转换回数组并按权重降序排序
  const updatedTags = Array.from(existingTagsMap.entries())
    .map(([tag_id, weight]) => ({ tag_id, weight }))
    .sort((a, b) => b.weight - a.weight);
  
  // 保存更新
  cache[midKey] = {
    mid,
    tags: updatedTags,
    lastUpdate: Date.now()
  };
  
  await setValue("upTagWeightsCache", cache, options);
}

/**
 * 清除UP的标签权重
 */
export async function clearUPTagWeights(
  mid: number,
  options: StorageOptions = {}
): Promise<void> {
  const cache = (await getValue<UPTagWeightsCache>("upTagWeightsCache", options)) ?? {};
  const midKey = String(mid);
  if (cache[midKey]) {
    delete cache[midKey];
    await setValue("upTagWeightsCache", cache, options);
  }
}

// ==================== UP手动标签操作 ====================

/**
 * 获取UP的手动标签
 */
export async function getUPManualTags(
  mid: number,
  options: StorageOptions = {}
): Promise<string[]> {
  const cache = (await getValue<UPManualTagsCache>("upManualTagsCache", options)) ?? {};
  return cache[String(mid)]?.tag_ids ?? [];
}

/**
 * 设置UP的手动标签
 */
export async function setUPManualTags(
  mid: number,
  tagIds: string[],
  options: StorageOptions = {}
): Promise<void> {
  const cache = (await getValue<UPManualTagsCache>("upManualTagsCache", options)) ?? {};
  const midKey = String(mid);
  
  cache[midKey] = {
    mid,
    tag_ids: tagIds,
    lastUpdate: Date.now()
  };
  
  await setValue("upManualTagsCache", cache, options);
}

/**
 * 添加标签到UP的手动标签列表
 */
export async function addTagToUPManualTags(
  mid: number,
  tagId: string,
  options: StorageOptions = {}
): Promise<void> {
  const cache = (await getValue<UPManualTagsCache>("upManualTagsCache", options)) ?? {};
  const midKey = String(mid);
  
  const existing = cache[midKey] ?? { mid, tag_ids: [], lastUpdate: 0 };
  if (!existing.tag_ids.includes(tagId)) {
    existing.tag_ids.push(tagId);
    existing.lastUpdate = Date.now();
  }
  
  cache[midKey] = existing;
  await setValue("upManualTagsCache", cache, options);
}

/**
 * 从UP的手动标签列表中移除标签
 */
export async function removeTagFromUPManualTags(
  mid: number,
  tagId: string,
  options: StorageOptions = {}
): Promise<void> {
  const cache = (await getValue<UPManualTagsCache>("upManualTagsCache", options)) ?? {};
  const midKey = String(mid);
  
  if (cache[midKey]) {
    cache[midKey].tag_ids = cache[midKey].tag_ids.filter(id => id !== tagId);
    cache[midKey].lastUpdate = Date.now();
    await setValue("upManualTagsCache", cache, options);
  }
}

// ==================== 大分区操作 ====================

/**
 * 获取大分区库
 */
export async function getCategoryLibrary(
  options: StorageOptions = {}
): Promise<CategoryLibrary> {
  return (await getValue<CategoryLibrary>("categoryLibrary", options)) ?? {};
}

/**
 * 保存大分区库
 */
export async function saveCategoryLibrary(
  library: CategoryLibrary,
  options: StorageOptions = {}
): Promise<void> {
  await setValue("categoryLibrary", library, options);
}

/**
 * 创建大分区
 */
export async function createCategory(
  name: string,
  tagIds: string[] = [],
  options: StorageOptions = {}
): Promise<Category> {
  const library = await getCategoryLibrary(options);
  const id = `category_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  
  const category: Category = {
    id,
    name,
    tag_ids: tagIds,
    created_at: Date.now()
  };
  
  library[id] = category;
  await saveCategoryLibrary(library, options);
  return category;
}

/**
 * 删除大分区
 */
export async function deleteCategory(
  categoryId: string,
  options: StorageOptions = {}
): Promise<void> {
  const library = await getCategoryLibrary(options);
  if (library[categoryId]) {
    delete library[categoryId];
    await saveCategoryLibrary(library, options);
  }
}

/**
 * 添加标签到大分区
 */
export async function addTagToCategory(
  categoryId: string,
  tagId: string,
  options: StorageOptions = {}
): Promise<void> {
  const library = await getCategoryLibrary(options);
  if (library[categoryId]) {
    if (!library[categoryId].tag_ids.includes(tagId)) {
      library[categoryId].tag_ids.push(tagId);
      await saveCategoryLibrary(library, options);
    }
  }
}

/**
 * 从大分区中移除标签
 */
export async function removeTagFromCategory(
  categoryId: string,
  tagId: string,
  options: StorageOptions = {}
): Promise<void> {
  const library = await getCategoryLibrary(options);
  if (library[categoryId]) {
    library[categoryId].tag_ids = library[categoryId].tag_ids.filter(id => id !== tagId);
    await saveCategoryLibrary(library, options);
  }
}

/**
 * Save UP list cache.
 */
export async function saveUPList(
  upList: UP[],
  options: StorageOptions = {}
): Promise<void> {
  const payload: UPCache = { upList, lastUpdate: Date.now() };
  await setValue("upList", payload, options);
}

/**
 * Load UP list cache.
 */
export async function loadUPList(
  options: StorageOptions = {}
): Promise<UPCache | null> {
  return getValue<UPCache>("upList", options);
}

/**
 * 获取已关注的UP列表
 */
export async function getFollowedUPList(
  options: StorageOptions = {}
): Promise<UP[]> {
  const cache = await loadUPList(options);
  if (!cache) {
    return [];
  }
  return cache.upList.filter(up => up.is_followed);
}

/**
 * 更新UP的关注状态
 */
export async function updateUPFollowStatus(
  mid: number,
  isFollowed: boolean,
  options: StorageOptions = {}
): Promise<void> {
  const cache = await loadUPList(options);
  if (!cache) {
    return;
  }
  
  const up = cache.upList.find(u => u.mid === mid);
  if (up) {
    up.is_followed = isFollowed;
    await saveUPList(cache.upList, options);
  }
}

/**
 * Save video cache for a specific UP.
 */
export async function saveVideoCache(
  mid: number,
  videos: Video[],
  options: StorageOptions = {}
): Promise<void> {
  const cache = (await getValue<VideoCache>("videoCache", options)) ?? {};
  cache[String(mid)] = { videos, lastUpdate: Date.now() };
  await setValue("videoCache", cache, options);
}

/**
 * Load video cache for a specific UP.
 */
export async function loadVideoCache(
  mid: number,
  options: StorageOptions = {}
): Promise<VideoCacheEntry | null> {
  const cache = await getValue<VideoCache>("videoCache", options);
  if (!cache) {
    return null;
  }
  return cache[String(mid)] ?? null;
}

/**
 * Update interest score for a tag.
 */
export async function updateInterest(
  tag: string,
  score: number,
  options: StorageOptions = {}
): Promise<UserInterest> {
  const profile = (await getValue<InterestProfile>("interestProfile", options)) ?? {};
  const existing = profile[tag]?.score ?? 0;
  const next: UserInterest = { tag, score: existing + score };
  profile[tag] = next;
  await setValue("interestProfile", profile, options);
  return next;
}

// ==================== UP头像图片数据缓存操作 ====================

/**
 * 保存UP的头像图片数据
 */
export async function saveUPFaceData(
  mid: number,
  faceData: string,
  options: StorageOptions = {}
): Promise<void> {
  const cache = (await getValue<UPFaceDataCache>("upFaceDataCache", options)) ?? {};
  cache[String(mid)] = {
    mid,
    face_data: faceData,
    lastUpdate: Date.now()
  };
  await setValue("upFaceDataCache", cache, options);
}

/**
 * 获取UP的头像图片数据
 */
export async function getUPFaceData(
  mid: number,
  options: StorageOptions = {}
): Promise<string | null> {
  const cache = await getValue<UPFaceDataCache>("upFaceDataCache", options);
  if (!cache) {
    return null;
  }
  return cache[String(mid)]?.face_data ?? null;
}

/**
 * 批量保存多个UP的头像图片数据
 */
export async function saveMultipleUPFaceData(
  faceDataMap: Record<number, string>,
  options: StorageOptions = {}
): Promise<void> {
  const cache = (await getValue<UPFaceDataCache>("upFaceDataCache", options)) ?? {};
  
  for (const [mid, faceData] of Object.entries(faceDataMap)) {
    cache[String(mid)] = {
      mid: Number(mid),
      face_data: faceData,
      lastUpdate: Date.now()
    };
  }
  
  await setValue("upFaceDataCache", cache, options);
}

/**
 * 清除UP的头像图片数据
 */
export async function clearUPFaceData(
  mid: number,
  options: StorageOptions = {}
): Promise<void> {
  const cache = await getValue<UPFaceDataCache>("upFaceDataCache", options);
  if (!cache) {
    return;
  }
  
  const midKey = String(mid);
  if (cache[midKey]) {
    delete cache[midKey];
    await setValue("upFaceDataCache", cache, options);
  }
}


