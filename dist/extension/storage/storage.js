/**
 * Storage helpers based on chrome.storage.local.
 */
function getDefaultStorage() {
    return chrome.storage;
}
/**
 * Set a value in storage.
 */
export async function setValue(key, value, options = {}) {
    const storage = options.storage ?? getDefaultStorage();
    console.log("[Storage] Set", key);
    await storage.local.set({ [key]: value });
}
/**
 * Get a value from storage.
 */
export async function getValue(key, options = {}) {
    const storage = options.storage ?? getDefaultStorage();
    const result = await storage.local.get(key);
    const value = result[key];
    return value ?? null;
}
// ==================== 标签库操作 ====================
/**
 * 获取标签库
 */
export async function getTagLibrary(options = {}) {
    return (await getValue("tagLibrary", options)) ?? {};
}
/**
 * 保存标签库
 */
export async function saveTagLibrary(library, options = {}) {
    await setValue("tagLibrary", library, options);
}
/**
 * 添加标签到标签库
 */
export async function addTagToLibrary(name, options = {}) {
    const library = await getTagLibrary(options);
    // 检查是否已存在相同名称的标签
    const existingTag = Object.values(library).find(tag => tag.name === name);
    if (existingTag) {
        return existingTag;
    }
    // 生成标签ID（使用名称的哈希值）
    const id = `tag_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const tag = {
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
export async function getTagById(id, options = {}) {
    const library = await getTagLibrary(options);
    return library[id] ?? null;
}
/**
 * 根据名称获取标签ID
 */
export async function getTagIdByName(name, options = {}) {
    const library = await getTagLibrary(options);
    const tag = Object.values(library).find(t => t.name === name);
    return tag?.id ?? null;
}
/**
 * 批量添加标签到标签库
 */
export async function addTagsToLibrary(names, options = {}) {
    const library = await getTagLibrary(options);
    const addedTags = [];
    for (const name of names) {
        // 检查是否已存在
        const existingTag = Object.values(library).find(tag => tag.name === name);
        if (existingTag) {
            addedTags.push(existingTag);
            continue;
        }
        // 创建新标签
        const id = `tag_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        const tag = {
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
export async function getUPTagWeights(mid, options = {}) {
    const cache = (await getValue("upTagWeightsCache", options)) ?? {};
    return cache[String(mid)] ?? null;
}
/**
 * 更新UP的标签权重
 */
export async function updateUPTagWeights(mid, tagIds, options = {}) {
    const cache = (await getValue("upTagWeightsCache", options)) ?? {};
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
export async function clearUPTagWeights(mid, options = {}) {
    const cache = (await getValue("upTagWeightsCache", options)) ?? {};
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
export async function getUPManualTags(mid, options = {}) {
    const cache = (await getValue("upManualTagsCache", options)) ?? {};
    return cache[String(mid)]?.tag_ids ?? [];
}
/**
 * 设置UP的手动标签
 */
export async function setUPManualTags(mid, tagIds, options = {}) {
    const cache = (await getValue("upManualTagsCache", options)) ?? {};
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
export async function addTagToUPManualTags(mid, tagId, options = {}) {
    const cache = (await getValue("upManualTagsCache", options)) ?? {};
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
export async function removeTagFromUPManualTags(mid, tagId, options = {}) {
    const cache = (await getValue("upManualTagsCache", options)) ?? {};
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
export async function getCategoryLibrary(options = {}) {
    return (await getValue("categoryLibrary", options)) ?? {};
}
/**
 * 保存大分区库
 */
export async function saveCategoryLibrary(library, options = {}) {
    await setValue("categoryLibrary", library, options);
}
/**
 * 创建大分区
 */
export async function createCategory(name, tagIds = [], options = {}) {
    const library = await getCategoryLibrary(options);
    const id = `category_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const category = {
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
export async function deleteCategory(categoryId, options = {}) {
    const library = await getCategoryLibrary(options);
    if (library[categoryId]) {
        delete library[categoryId];
        await saveCategoryLibrary(library, options);
    }
}
/**
 * 添加标签到大分区
 */
export async function addTagToCategory(categoryId, tagId, options = {}) {
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
export async function removeTagFromCategory(categoryId, tagId, options = {}) {
    const library = await getCategoryLibrary(options);
    if (library[categoryId]) {
        library[categoryId].tag_ids = library[categoryId].tag_ids.filter(id => id !== tagId);
        await saveCategoryLibrary(library, options);
    }
}
/**
 * Save UP list cache.
 */
export async function saveUPList(upList, options = {}) {
    const payload = { upList, lastUpdate: Date.now() };
    await setValue("upList", payload, options);
}
/**
 * Load UP list cache.
 */
export async function loadUPList(options = {}) {
    return getValue("upList", options);
}
/**
 * 获取已关注的UP列表
 */
export async function getFollowedUPList(options = {}) {
    const cache = await loadUPList(options);
    if (!cache) {
        return [];
    }
    return cache.upList.filter(up => up.is_followed);
}
/**
 * 更新UP的关注状态
 */
export async function updateUPFollowStatus(mid, isFollowed, options = {}) {
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
export async function saveVideoCache(mid, videos, options = {}) {
    const cache = (await getValue("videoCache", options)) ?? {};
    cache[String(mid)] = { videos, lastUpdate: Date.now() };
    await setValue("videoCache", cache, options);
}
/**
 * Load video cache for a specific UP.
 */
export async function loadVideoCache(mid, options = {}) {
    const cache = await getValue("videoCache", options);
    if (!cache) {
        return null;
    }
    return cache[String(mid)] ?? null;
}
/**
 * Update interest score for a tag.
 */
export async function updateInterest(tag, score, options = {}) {
    const profile = (await getValue("interestProfile", options)) ?? {};
    const existing = profile[tag]?.score ?? 0;
    const next = { tag, score: existing + score };
    profile[tag] = next;
    await setValue("interestProfile", profile, options);
    return next;
}
// ==================== UP头像图片数据缓存操作 ====================
/**
 * 保存UP的头像图片数据
 */
export async function saveUPFaceData(mid, faceData, options = {}) {
    const cache = (await getValue("upFaceDataCache", options)) ?? {};
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
export async function getUPFaceData(mid, options = {}) {
    const cache = await getValue("upFaceDataCache", options);
    if (!cache) {
        return null;
    }
    return cache[String(mid)]?.face_data ?? null;
}
/**
 * 批量保存多个UP的头像图片数据
 */
export async function saveMultipleUPFaceData(faceDataMap, options = {}) {
    const cache = (await getValue("upFaceDataCache", options)) ?? {};
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
export async function clearUPFaceData(mid, options = {}) {
    const cache = await getValue("upFaceDataCache", options);
    if (!cache) {
        return;
    }
    const midKey = String(mid);
    if (cache[midKey]) {
        delete cache[midKey];
        await setValue("upFaceDataCache", cache, options);
    }
}
