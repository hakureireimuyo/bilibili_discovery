/**
 * Storage helpers based on IndexedDB.
 */

// ==================== 类型定义 ====================

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
  created_at?: number; // 创建时间戳
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
 * UP标签计数条目
 */
export interface UPTagCount {
  tag: string;
  count: number;
}

/**
 * UP标签缓存，键为UP的mid
 */
export type UPTagCache = Record<string, { tags: UPTagCount[]; lastUpdate: number }>;

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

// ==================== IndexedDB 配置 ====================

const DB_NAME = "BilibiliDiscoveryDB";
const DB_VERSION = 1;

// 定义所有对象存储
const STORES = {
  upList: { keyPath: "mid" },
  videoCache: { keyPath: "mid" },
  tagLibrary: { keyPath: "id" },
  upTagWeightsCache: { keyPath: "mid" },
  upManualTagsCache: { keyPath: "mid" },
  categoryLibrary: { keyPath: "id" },
  interestProfile: { keyPath: "tag" },
  upFaceDataCache: { keyPath: "mid" },
  classifyStatus: { keyPath: "id" }
};

// ==================== IndexedDB 初始化 ====================

let db: IDBDatabase | null = null;

/**
 * 初始化IndexedDB数据库
 */
async function initDB(): Promise<IDBDatabase> {
  if (db) {
    return db;
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error("[IndexedDB] Failed to open database:", request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      db = request.result;
      console.log("[IndexedDB] Database opened successfully");
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;
      console.log("[IndexedDB] Database upgrade needed");

      // 创建所有对象存储
      for (const [storeName, options] of Object.entries(STORES)) {
        if (!database.objectStoreNames.contains(storeName)) {
          const objectStore = database.createObjectStore(storeName, { keyPath: options.keyPath });
          console.log(`[IndexedDB] Created object store: ${storeName}`);

          // 为某些存储创建索引
          if (storeName === "tagLibrary") {
            objectStore.createIndex("name", "name", { unique: true });
          }
          if (storeName === "upManualTagsCache") {
            objectStore.createIndex("lastUpdate", "lastUpdate");
          }
          if (storeName === "upTagWeightsCache") {
            objectStore.createIndex("lastUpdate", "lastUpdate");
          }
        }
      }
    };
  });
}

// ==================== 通用数据库操作 ====================

/**
 * 获取对象存储
 */
async function getObjectStore(storeName: string, mode: IDBTransactionMode = "readonly"): Promise<IDBObjectStore> {
  const database = await initDB();
  const transaction = database.transaction(storeName, mode);
  return transaction.objectStore(storeName);
}

/**
 * 获取单个记录
 */
async function getRecord<T>(storeName: string, key: IDBValidKey): Promise<T | null> {
  const objectStore = await getObjectStore(storeName);
  return new Promise((resolve, reject) => {
    const request = objectStore.get(key);
    request.onsuccess = () => resolve(request.result as T | null);
    request.onerror = () => reject(request.error);
  });
}

/**
 * 获取所有记录
 */
async function getAllRecords<T>(storeName: string): Promise<T[]> {
  const objectStore = await getObjectStore(storeName);
  return new Promise((resolve, reject) => {
    const request = objectStore.getAll();
    request.onsuccess = () => resolve(request.result as T[]);
    request.onerror = () => reject(request.error);
  });
}

/**
 * 添加或更新记录
 */
async function putRecord<T>(storeName: string, data: T): Promise<void> {
  const objectStore = await getObjectStore(storeName, "readwrite");
  return new Promise((resolve, reject) => {
    const request = objectStore.put(data);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * 删除记录
 */
async function deleteRecord(storeName: string, key: IDBValidKey): Promise<void> {
  const objectStore = await getObjectStore(storeName, "readwrite");
  return new Promise((resolve, reject) => {
    const request = objectStore.delete(key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * 清空对象存储
 */
async function clearStore(storeName: string): Promise<void> {
  const objectStore = await getObjectStore(storeName, "readwrite");
  return new Promise((resolve, reject) => {
    const request = objectStore.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// ==================== 标签库操作 ====================

/**
 * 获取标签库
 */
export async function getTagLibrary(): Promise<TagLibrary> {
  const tags = await getAllRecords<Tag>("tagLibrary");
  const library: TagLibrary = {};
  tags.forEach(tag => {
    library[tag.id] = tag;
  });
  return library;
}

/**
 * 保存标签库
 */
export async function saveTagLibrary(library: TagLibrary): Promise<void> {
  const objectStore = await getObjectStore("tagLibrary", "readwrite");
  await clearStore("tagLibrary");

  for (const tag of Object.values(library)) {
    await putRecord("tagLibrary", tag);
  }
}

/**
 * 添加标签到标签库
 */
export async function addTagToLibrary(name: string): Promise<Tag> {
  const library = await getTagLibrary();

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

  await putRecord("tagLibrary", tag);
  return tag;
}

/**
 * 根据ID获取标签
 */
export async function getTagById(id: string): Promise<Tag | null> {
  return getRecord<Tag>("tagLibrary", id);
}

/**
 * 根据名称获取标签ID
 */
export async function getTagIdByName(name: string): Promise<string | null> {
  const library = await getTagLibrary();
  const tag = Object.values(library).find(t => t.name === name);
  return tag?.id ?? null;
}

/**
 * 批量添加标签到标签库
 */
export async function addTagsToLibrary(names: string[]): Promise<Tag[]> {
  const library = await getTagLibrary();
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

    await putRecord("tagLibrary", tag);
    addedTags.push(tag);
  }

  return addedTags;
}

// ==================== UP-标签权重操作 ====================

/**
 * 获取UP的标签权重列表
 */
export async function getUPTagWeights(mid: number): Promise<UPTagWeights | null> {
  return getRecord<UPTagWeights>("upTagWeightsCache", mid);
}

/**
 * 更新UP的标签权重
 */
export async function updateUPTagWeights(mid: number, tagIds: string[]): Promise<void> {
  const existingWeights = await getUPTagWeights(mid) ?? { mid, tags: [], lastUpdate: 0 };
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
  await putRecord("upTagWeightsCache", {
    mid,
    tags: updatedTags,
    lastUpdate: Date.now()
  });
}

/**
 * 清除UP的标签权重
 */
export async function clearUPTagWeights(mid: number): Promise<void> {
  await deleteRecord("upTagWeightsCache", mid);
}

/**
 * 获取所有UP的标签计数
 */
export async function getUPTagCounts(): Promise<UPTagCache> {
  const weights = await getAllRecords<UPTagWeights>("upTagWeightsCache");
  const cache: UPTagCache = {};
  for (const weight of weights) {
    cache[String(weight.mid)] = {
      tags: weight.tags.map(t => ({ tag: t.tag_id, count: t.weight })),
      lastUpdate: weight.lastUpdate
    };
  }
  return cache;
}

// ==================== UP手动标签操作 ====================

/**
 * 获取UP的手动标签
 */
export async function getUPManualTags(mid: number): Promise<string[]> {
  const manualTag = await getRecord<UPManualTag>("upManualTagsCache", mid);
  return manualTag?.tag_ids ?? [];
}

/**
 * 获取所有UP的手动标签
 */
export async function getAllUPManualTags(): Promise<Record<string, string[]>> {
  const manualTags = await getAllRecords<UPManualTag>("upManualTagsCache");
  const result: Record<string, string[]> = {};
  for (const tag of manualTags) {
    result[String(tag.mid)] = tag.tag_ids;
  }
  return result;
}

/**
 * 设置UP的手动标签
 */
export async function setUPManualTags(mid: number, tagIds: string[]): Promise<void> {
  await putRecord("upManualTagsCache", {
    mid,
    tag_ids: tagIds,
    lastUpdate: Date.now()
  });
}

/**
 * 添加标签到UP的手动标签列表
 */
export async function addTagToUPManualTags(mid: number, tagId: string): Promise<void> {
  const existing = await getRecord<UPManualTag>("upManualTagsCache", mid) ?? { mid, tag_ids: [], lastUpdate: 0 };
  if (!existing.tag_ids.includes(tagId)) {
    existing.tag_ids.push(tagId);
    existing.lastUpdate = Date.now();
    await putRecord("upManualTagsCache", existing);
  }
}

/**
 * 从UP的手动标签列表中移除标签
 */
export async function removeTagFromUPManualTags(mid: number, tagId: string): Promise<void> {
  const existing = await getRecord<UPManualTag>("upManualTagsCache", mid);
  if (existing) {
    existing.tag_ids = existing.tag_ids.filter(id => id !== tagId);
    existing.lastUpdate = Date.now();
    await putRecord("upManualTagsCache", existing);
  }
}

// ==================== 大分区操作 ====================

/**
 * 获取大分区库
 */
export async function getCategoryLibrary(): Promise<CategoryLibrary> {
  const categories = await getAllRecords<Category>("categoryLibrary");
  const library: CategoryLibrary = {};
  categories.forEach(category => {
    library[category.id] = category;
  });
  return library;
}

/**
 * 保存大分区库
 */
export async function saveCategoryLibrary(library: CategoryLibrary): Promise<void> {
  await clearStore("categoryLibrary");

  for (const category of Object.values(library)) {
    await putRecord("categoryLibrary", category);
  }
}

/**
 * 创建大分区
 */
export async function createCategory(name: string, tagIds: string[] = []): Promise<Category> {
  const id = `category_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  const category: Category = {
    id,
    name,
    tag_ids: tagIds,
    created_at: Date.now()
  };

  await putRecord("categoryLibrary", category);
  return category;
}

/**
 * 删除大分区
 */
export async function deleteCategory(categoryId: string): Promise<void> {
  await deleteRecord("categoryLibrary", categoryId);
}

/**
 * 添加标签到大分区
 */
export async function addTagToCategory(categoryId: string, tagId: string): Promise<void> {
  const category = await getRecord<Category>("categoryLibrary", categoryId);
  if (category) {
    if (!category.tag_ids.includes(tagId)) {
      category.tag_ids.push(tagId);
      await putRecord("categoryLibrary", category);
    }
  }
}

/**
 * 从大分区中移除标签
 */
export async function removeTagFromCategory(categoryId: string, tagId: string): Promise<void> {
  const category = await getRecord<Category>("categoryLibrary", categoryId);
  if (category) {
    category.tag_ids = category.tag_ids.filter(id => id !== tagId);
    await putRecord("categoryLibrary", category);
  }
}

// ==================== UP列表操作 ====================

/**
 * Save UP list cache.
 */
export async function saveUPList(upList: UP[]): Promise<void> {
  const payload: UPCache = { upList, lastUpdate: Date.now() };
  // 清除旧的UP列表
  await clearStore("upList");

  // 保存新的UP列表
  for (const up of upList) {
    await putRecord("upList", up);
  }
}

/**
 * Load UP list cache.
 */
export async function loadUPList(): Promise<UPCache | null> {
  const upList = await getAllRecords<UP>("upList");
  if (upList.length === 0) {
    return null;
  }

  // 获取最后更新时间
  const lastUpdate = upList.length > 0 ? upList[0].follow_time : Date.now();

  return { upList, lastUpdate };
}

/**
 * 获取已关注的UP列表
 */
export async function getFollowedUPList(): Promise<UP[]> {
  const cache = await loadUPList();
  if (!cache) {
    return [];
  }
  return cache.upList.filter(up => up.is_followed);
}

/**
 * 更新UP的关注状态
 */
export async function updateUPFollowStatus(mid: number, isFollowed: boolean): Promise<void> {
  const up = await getRecord<UP>("upList", mid);
  if (up) {
    up.is_followed = isFollowed;
    await putRecord("upList", up);
  }
}

// ==================== 视频缓存操作 ====================

/**
 * Save video cache for a specific UP.
 */
export async function saveVideoCache(mid: number, videos: Video[]): Promise<void> {
  await putRecord("videoCache", {
    mid,
    videos,
    lastUpdate: Date.now()
  });
}

/**
 * Load video cache for a specific UP.
 */
export async function loadVideoCache(mid: number): Promise<VideoCacheEntry | null> {
  return getRecord<VideoCacheEntry>("videoCache", mid);
}

// ==================== 用户兴趣操作 ====================

/**
 * Update interest score for a tag.
 */
export async function updateInterest(tag: string, score: number): Promise<UserInterest> {
  const existing = await getRecord<UserInterest>("interestProfile", tag) ?? { tag, score: 0 };
  const next: UserInterest = { tag, score: existing.score + score };
  await putRecord("interestProfile", next);
  return next;
}

// ==================== UP头像图片数据缓存操作 ====================

/**
 * 保存UP的头像图片数据
 */
export async function saveUPFaceData(mid: number, faceData: string): Promise<void> {
  await putRecord("upFaceDataCache", {
    mid,
    face_data: faceData,
    lastUpdate: Date.now()
  });
}

/**
 * 获取UP的头像图片数据
 */
export async function getUPFaceData(mid: number): Promise<string | null> {
  const entry = await getRecord<UPFaceDataCacheEntry>("upFaceDataCache", mid);
  return entry?.face_data ?? null;
}

/**
 * 批量保存多个UP的头像图片数据
 */
export async function saveMultipleUPFaceData(faceDataMap: Record<number, string>): Promise<void> {
  for (const [mid, faceData] of Object.entries(faceDataMap)) {
    await saveUPFaceData(Number(mid), faceData);
  }
}

/**
 * 清除UP的头像图片数据
 */
export async function clearUPFaceData(mid: number): Promise<void> {
  await deleteRecord("upFaceDataCache", mid);
}

// ==================== 分类状态操作 ====================

/**
 * 获取分类状态
 */
export async function getClassifyStatus(): Promise<{ lastUpdate: number } | null> {
  return getRecord<{ lastUpdate: number }>("classifyStatus", "status");
}

/**
 * 保存分类状态
 */
export async function setClassifyStatus(lastUpdate: number): Promise<void> {
  await putRecord("classifyStatus", {
    id: "status",
    lastUpdate
  });
}

// ==================== 通用存储操作 ====================

/**
 * Set a value in storage.
 */
export async function setValue<T>(key: string, value: T): Promise<void> {
  // 对于特殊键，使用特定的存储方法
  if (key === "classifyStatus") {
    await setClassifyStatus((value as any).lastUpdate);
    return;
  }

  // 对于其他键，使用通用存储
  await putRecord("classifyStatus", {
    id: key,
    value
  });
}

/**
 * Get a value from storage.
 */
export async function getValue<T>(key: string): Promise<T | null> {
  // 对于特殊键，使用特定的存储方法
  if (key === "classifyStatus") {
    const status = await getClassifyStatus();
    return status as T | null;
  }

  // 对于 upList 键，使用 loadUPList 方法
  if (key === "upList") {
    const cache = await loadUPList();
    return cache as T | null;
  }

  // 对于其他键，使用通用存储
  // setValue 将数据存储在 classifyStatus 存储中，使用 id 字段作为键
  // 所以这里需要使用 key 作为 id 来查找记录
  const record = await getRecord<{ id: string; value: T }>("classifyStatus", key);
  return record?.value ?? null;
}
