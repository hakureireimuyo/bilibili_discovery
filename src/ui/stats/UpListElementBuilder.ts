
/**
 * UP列表元素构建器
 * 职责：将Creator数据对象转换为DOM元素
 */

import type { Creator } from "../../database/types/index.js";
import type { IUpListElementBuilder } from "./up-list-types.js";
import type { ServiceContainer } from "./services.js";
import type { StatsState } from "./types.js";
import { colorFromTag } from "../../utls/tag-utils.js";
import { createDragGhost, setDragContext, getDragContext, type DragContext } from "../../utls/drag-utils.js";
import { buildUserSpaceUrl, buildSearchUrl } from "../../utls/url-builder.js";

/**
 * UP列表元素构建器实现
 */
export class UpListElementBuilder implements IUpListElementBuilder {
  constructor(
    private services: ServiceContainer,
    private currentState: StatsState | null = null
  ) {}

  /**
   * 更新当前状态
   */
  updateState(state: StatsState): void {
    this.currentState = state;
  }

  /**
   * 构建单个UP主元素
   */
  async buildElement(creator: Creator): Promise<HTMLElement> {
    const creatorElement = document.createElement("div");
    creatorElement.className = "up-item";
    creatorElement.dataset.mid = String(creator.creatorId);

    // 添加头像
    const avatarContainer = await this.createAvatarElement(creator);
    creatorElement.appendChild(avatarContainer);

    // 添加UP主信息
    const creatorInfo = await this.createCreatorInfoElement(creator);
    creatorElement.appendChild(creatorInfo);

    // 添加拖放事件处理
    this.setupDragDropHandlers(creatorElement, creator);

    return creatorElement;
  }

  /**
   * 批量构建UP主元素
   */
  async buildElements(creators: Creator[]): Promise<HTMLElement[]> {
    console.log(`[UpListElementBuilder] 开始渲染UP列表，共 ${creators.length} 个创作者`);

    const creatorIds = new Set<number>();
    const newElements: HTMLElement[] = [];

    for (const creator of creators) {
      if (creatorIds.has(creator.creatorId)) {
        console.warn(`[UpListElementBuilder] 发现重复的创作者 (creatorId: ${creator.creatorId})`);
        continue;
      }
      creatorIds.add(creator.creatorId);
      const creatorElement = await this.buildElement(creator);
      newElements.push(creatorElement);
    }

    return newElements;
  }

  /**
   * 创建头像元素
   */
  private async createAvatarElement(creator: Creator): Promise<HTMLElement> {
    const avatarContainer = document.createElement("div");
    avatarContainer.className = "up-avatar-container";

    const avatarImg = document.createElement("img");
    avatarImg.className = "up-avatar";
    avatarImg.alt = creator.name;
    avatarImg.loading = "lazy";

    // 尝试加载头像
    try {
      const avatarBlob = await this.services.creatorRepo.getAvatarBinary(creator.creatorId);
      if (avatarBlob) {
        const avatarUrl = URL.createObjectURL(avatarBlob);
        avatarImg.src = avatarUrl;
        avatarImg.onload = () => {
          URL.revokeObjectURL(avatarUrl);
        };
      } else {
        avatarImg.src = this.getDefaultAvatar();
      }
    } catch (error) {
      console.error(`[UpListElementBuilder] 加载头像失败 (creatorId: ${creator.creatorId}):`, error);
      avatarImg.src = this.getDefaultAvatar();
    }

    avatarContainer.appendChild(avatarImg);
    return avatarContainer;
  }

  /**
   * 获取默认头像URL
   */
  private getDefaultAvatar(): string {
    return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 150 150'%3E%3Crect width='150' height='150' fill='%23ccc'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='Arial' font-size='60' fill='%23666'%3E%3F%3C/text%3E%3C/svg%3E";
  }

  /**
   * 创建UP主信息元素
   */
  private async createCreatorInfoElement(creator: Creator): Promise<HTMLElement> {
    const creatorInfo = document.createElement("div");
    creatorInfo.className = "up-info";

    // 添加名称和关注状态
    const nameRow = this.createNameRow(creator);
    creatorInfo.appendChild(nameRow);

    // 添加简介
    if (creator.description) {
      const creatorDesc = this.createDescriptionElement(creator.description);
      creatorInfo.appendChild(creatorDesc);
    }

    // 添加标签
    if (creator.tagWeights && creator.tagWeights.length > 0) {
      const tagsContainer = await this.createTagsContainer(creator);
      creatorInfo.appendChild(tagsContainer);
    }

    return creatorInfo;
  }

  /**
   * 创建名称和关注状态行
   */
  private createNameRow(creator: Creator): HTMLElement {
    const nameRow = document.createElement("div");
    nameRow.className = "up-name-row";

    const creatorName = document.createElement("div");
    creatorName.className = "up-name";
    creatorName.textContent = creator.name;
    creatorName.style.cursor = "pointer";
    // 点击时打开新标签页
    creatorName.addEventListener("click", (e) => {
      e.stopPropagation();
      const url = buildUserSpaceUrl(creator.creatorId);
      window.open(url, "_blank", "noopener,noreferrer");
    });
    nameRow.appendChild(creatorName);

    return nameRow;
  }

  /**
   * 创建简介元素
   */
  private createDescriptionElement(description: string): HTMLElement {
    const creatorDesc = document.createElement("div");
    creatorDesc.className = "up-description";
    creatorDesc.textContent = description.length > 100
      ? description.substring(0, 100) + "..."
      : description;
    return creatorDesc;
  }

  /**
   * 创建标签容器
   */
  private async createTagsContainer(creator: Creator): Promise<HTMLElement> {
    const tagsContainer = document.createElement("div");
    tagsContainer.className = "up-tags";

    // 按权重排序，取前5个标签
    const sortedTags = [...creator.tagWeights]
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // 获取标签名称
    const tagIds = sortedTags.map(t => t.tagId);
    const tagsMap = await this.services.tagRepo.getTags(tagIds);

    // 分离user标签和system标签
    const userTags = sortedTags.filter(t => t.source === 'user');
    const systemTags = sortedTags
      .filter(t => t.source === 'system')
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // 渲染user标签
    for (const tagWeight of userTags) {
      const tag = tagsMap.get(tagWeight.tagId);
      const tagName = tag?.name || String(tagWeight.tagId);
      const tagElement = this.createUserTagElement(tagWeight, tagName, creator.creatorId);
      tagsContainer.appendChild(tagElement);
    }

    // 如果两种标签都存在，添加分隔符
    if (userTags.length > 0 && systemTags.length > 0) {
      const divider = document.createElement("span");
      divider.className = "tag-divider";
      tagsContainer.appendChild(divider);
    }

    // 渲染system标签
    for (const tagWeight of systemTags) {
      const tag = tagsMap.get(tagWeight.tagId);
      const tagName = tag?.name || String(tagWeight.tagId);
      const tagElement = this.createSystemTagElement(tagWeight, tagName, creator.creatorId);
      tagsContainer.appendChild(tagElement);
    }

    return tagsContainer;
  }

  /**
   * 创建用户标签元素
   */
  private createUserTagElement(tagWeight: any, tagName: string, creatorId: number): HTMLElement {
    const tagElement = document.createElement("div");
    tagElement.className = "tag-pill";
    tagElement.textContent = tagName;
    tagElement.style.backgroundColor = colorFromTag(tagName);
    tagElement.draggable = true;
    tagElement.style.cursor = "pointer";
    // 点击时打开新标签页
    tagElement.addEventListener("click", (e) => {
      e.stopPropagation();
      const url = buildSearchUrl(tagName);
      window.open(url, "_blank", "noopener,noreferrer");
    });

    // 设置拖拽开始事件
    tagElement.addEventListener('dragstart', (e) => {
      const context: DragContext = {
        tagId: tagWeight.tagId,
        tagName,
        originUpMid: creatorId,
        dropped: false,
        isFilterTag: false,
        isSystemTag: false
      };
      setDragContext(context);
      createDragGhost(e as DragEvent, tagName);
    });

    // 设置拖拽结束事件
    tagElement.addEventListener('dragend', async (e) => {
      setTimeout(async () => {
        const context = getDragContext();
        if (context && !context.dropped && context.originUpMid === creatorId) {
          try {
            const tag = await this.services.tagRepo.getTag(context.tagId);
            if (tag && this.currentState) {
              await this.services.creatorRepo.removeTag(creatorId, tag);
              tagElement.remove();
            }
          } catch (error) {
            console.error('[UpListElementBuilder] 删除UP标签失败:', error);
          }
        }
      }, 0);
    });

    return tagElement;
  }

  /**
   * 创建系统标签元素
   */
  private createSystemTagElement(tagWeight: any, tagName: string, creatorId: number): HTMLElement {
    const tagElement = document.createElement("div");
    tagElement.className = "tag-pill";
    tagElement.textContent = `${tagName}${tagWeight.count > 0 ? ` (${tagWeight.count})` : ''}`;
    tagElement.style.backgroundColor = colorFromTag(tagName);
    tagElement.style.opacity = "0.6";
    tagElement.draggable = true;
    tagElement.style.cursor = "pointer";
    // 点击时打开新标签页
    tagElement.addEventListener("click", (e) => {
      e.stopPropagation();
      const url = buildSearchUrl(tagName);
      window.open(url, "_blank", "noopener,noreferrer");
    });

    tagElement.addEventListener('dragstart', (e) => {
      const context: DragContext = {
        tagId: tagWeight.tagId,
        tagName,
        originUpMid: creatorId,
        dropped: false,
        isFilterTag: false,
        isSystemTag: true
      };
      setDragContext(context);
      createDragGhost(e as DragEvent, tagName);
    });

    return tagElement;
  }

  /**
   * 设置拖放事件处理
   */
  private setupDragDropHandlers(creatorElement: HTMLElement, creator: Creator): void {
    // 拖拽进入事件
    creatorElement.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      creatorElement.classList.add('drag-over');
    });

    // 拖拽离开事件
    creatorElement.addEventListener('dragleave', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!creatorElement.contains(e.relatedTarget as Node)) {
        creatorElement.classList.remove('drag-over');
      }
    });

    // 放置事件
    creatorElement.addEventListener('drop', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      creatorElement.classList.remove('drag-over');

      const context = getDragContext();
      if (!context || !context.tagId) {
        return;
      }

      // 如果拖拽的是过滤区标签或系统标签，不处理
      if (context.isFilterTag || context.isSystemTag) {
        context.dropped = true;
        setDragContext(context);
        return;
      }

      // 处理标签放置
      await this.handleTagDrop(context, creatorElement, creator);
    });
  }

  /**
   * 处理标签放置
   */
  private async handleTagDrop(context: DragContext, creatorElement: HTMLElement, creator: Creator): Promise<void> {
    // 如果拖拽的是user标签，并且来源UP不是当前UP
    if (context.originUpMid && context.originUpMid !== creator.creatorId) {
      // 标记为已放置,这样dragend事件就不会删除来源UP的标签
      context.dropped = true;
      setDragContext(context);
      await this.addTagToCreator(context, creatorElement, creator);
    } else if (!context.originUpMid) {
      // 如果拖拽的是标签列表中的标签（没有originUpMid），添加到当前UP
      await this.addTagToCreator(context, creatorElement, creator);
    }
  }

  /**
   * 添加标签到UP主
   */
  private async addTagToCreator(context: DragContext, creatorElement: HTMLElement, creator: Creator): Promise<void> {
    try {
      const tag = await this.services.tagRepo.getTag(context.tagId);
      if (tag && this.currentState) {
        await this.services.creatorRepo.addTag(creator.creatorId, tag);

        const tagsContainer = creatorElement.querySelector('.up-tags');
        if (tagsContainer) {
          const newTagElement = this.createDroppedTagElement(context, creator.creatorId);
          this.insertTagElement(tagsContainer, newTagElement);
        }
      }
    } catch (error) {
      console.error('[UpListElementBuilder] 添加标签到UP失败:', error);
    }
  }

  /**
   * 创建放置后的标签元素
   */
  private createDroppedTagElement(context: DragContext, creatorId: number): HTMLElement {
    const newTagElement = document.createElement("div");
    newTagElement.className = "tag-pill";
    newTagElement.textContent = context.tagName;
    newTagElement.style.backgroundColor = colorFromTag(context.tagName);
    newTagElement.draggable = true;
    newTagElement.style.cursor = "pointer";
    // 点击时打开新标签页
    newTagElement.addEventListener("click", (e) => {
      e.stopPropagation();
      const url = buildSearchUrl(context.tagName);
      window.open(url, "_blank", "noopener,noreferrer");
    });

    // 添加拖拽事件
    newTagElement.addEventListener('dragstart', (e) => {
      const newContext: DragContext = {
        tagId: context.tagId,
        tagName: context.tagName,
        originUpMid: creatorId,
        dropped: false,
        isFilterTag: false
      };
      setDragContext(newContext);
      createDragGhost(e as DragEvent, context.tagName);
    });

    // 添加拖拽结束事件
    newTagElement.addEventListener('dragend', async (e) => {
      setTimeout(async () => {
        const dragContext = getDragContext();
        // 只有当标签没有被放置到任何地方,且来源UP是当前UP时才删除
        if (dragContext && !dragContext.dropped && dragContext.originUpMid === creatorId) {
          try {
            const tagToRemove = await this.services.tagRepo.getTag(dragContext.tagId);
            if (tagToRemove && this.currentState) {
              await this.services.creatorRepo.removeTag(creatorId, tagToRemove);
              newTagElement.remove();
            }
          } catch (error) {
            console.error('[UpListElementBuilder] 删除UP标签失败:', error);
          }
        }
      }, 0);
    });

    return newTagElement;
  }

  /**
   * 插入标签元素到容器
   */
  private insertTagElement(tagsContainer: Element, newTagElement: HTMLElement): void {
    const hasUserTags = tagsContainer.querySelectorAll('.tag-pill:not([style*="opacity"])').length > 0;
    const hasSystemTags = tagsContainer.querySelectorAll('.tag-pill[style*="opacity"]').length > 0;

    if (hasUserTags && !hasSystemTags) {
      // 如果只有user标签，直接添加
      tagsContainer.appendChild(newTagElement);
    } else if (!hasUserTags && hasSystemTags) {
      // 如果只有system标签，先添加分隔符，再添加标签
      const divider = document.createElement("span");
      divider.className = "tag-divider";
      tagsContainer.insertBefore(divider, tagsContainer.firstChild);
      tagsContainer.insertBefore(newTagElement, divider);
    } else if (hasUserTags && hasSystemTags) {
      // 如果两种标签都存在，找到分隔符，插入到分隔符之前
      const divider = tagsContainer.querySelector('.tag-divider');
      if (divider) {
        tagsContainer.insertBefore(newTagElement, divider);
      } else {
        tagsContainer.appendChild(newTagElement);
      }
    } else {
      tagsContainer.appendChild(newTagElement);
    }
  }
}
