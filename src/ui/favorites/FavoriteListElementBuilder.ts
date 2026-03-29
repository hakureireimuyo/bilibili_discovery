import { VideoRepository, type FavoriteVideoEntry, CacheManager, type ID } from "../../database/index.js";
import type { IElementBuilder } from "../../renderer/types.js";
import { buildSearchUrl, buildUserSpaceUrl, buildVideoUrl } from "../../utils/url-builder.js";
import { createDraggableTagPill } from "../shared/index.js";
import { formatDate, formatDuration } from "./helpers.js";

const DEFAULT_COVER =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 320 180'%3E%3Crect width='320' height='180' fill='%23d8dee9'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-size='18' fill='%235b6475'%3ENo Cover%3C/text%3E%3C/svg%3E";

export class FavoriteListElementBuilder implements IElementBuilder<FavoriteVideoEntry, HTMLElement> {
  private readonly videoRepository = new VideoRepository();
  private readonly cacheManager = CacheManager.getInstance();
  private readonly videoDataCache = this.cacheManager.getVideoDataCache();
  private readonly coverUrlCache = new Map<ID, string>();

  async buildElement(item: FavoriteVideoEntry): Promise<HTMLElement> {
    const card = document.createElement("article");
    card.className = "video-card";
    card.dataset.videoId = String(item.videoId);
    card.addEventListener("click", () => {
      window.open(buildVideoUrl(item.bv), "_blank", "noopener,noreferrer");
    });

    const coverWrapper = document.createElement("div");
    coverWrapper.className = "video-cover";

    const coverLink = document.createElement("a");
    coverLink.href = buildVideoUrl(item.bv);
    coverLink.target = "_blank";
    coverLink.rel = "noopener noreferrer";
    coverLink.addEventListener("click", (event) => event.stopPropagation());

    const cover = document.createElement("img");
    cover.alt = item.title;
    cover.loading = "lazy";
    cover.src = DEFAULT_COVER;
    await this.applyCoverSource(cover, item);
    coverLink.appendChild(cover);
    coverWrapper.appendChild(coverLink);
    card.appendChild(coverWrapper);

    const info = document.createElement("div");
    info.className = "video-info";

    const title = document.createElement("a");
    title.className = "video-title";
    title.href = buildVideoUrl(item.bv);
    title.target = "_blank";
    title.rel = "noopener noreferrer";
    title.textContent = item.title;
    title.addEventListener("click", (event) => event.stopPropagation());
    info.appendChild(title);

    const meta = document.createElement("div");
    meta.className = "video-meta";

    const creatorLink = document.createElement("a");
    creatorLink.href = buildUserSpaceUrl(item.creatorId);
    creatorLink.target = "_blank";
    creatorLink.rel = "noopener noreferrer";
    creatorLink.textContent = `@${item.creatorName}`;
    creatorLink.addEventListener("click", (event) => event.stopPropagation());
    meta.appendChild(creatorLink);

    const duration = document.createElement("span");
    duration.textContent = formatDuration(item.duration);
    meta.appendChild(duration);

    const publishTime = document.createElement("span");
    publishTime.textContent = formatDate(item.publishTime);
    meta.appendChild(publishTime);

    const collectionMeta = document.createElement("span");
    collectionMeta.textContent = item.collectionNames.join(" / ");
    meta.appendChild(collectionMeta);
    info.appendChild(meta);

    if (item.description) {
      const desc = document.createElement("div");
      desc.className = "video-description";
      desc.textContent = item.description;
      info.appendChild(desc);
    }

    const tags = document.createElement("div");
    tags.className = "video-tags";
    item.tags.forEach((tagId, index) => {
      const tagName = item.tagNames[index] ?? `Tag ${tagId}`;
      const pill = createDraggableTagPill({
        text: tagName,
        tagName,
        className: "video-tag",
        createDragContext: () => ({
          tagId,
          tagName,
          dropped: false,
          isFilterTag: false
        }),
        onClick: (event) => {
          event.stopPropagation();
          window.open(buildSearchUrl(tagName), "_blank", "noopener,noreferrer");
        }
      });
      tags.appendChild(pill);
    });
    info.appendChild(tags);

    card.appendChild(info);
    return card;
  }

  async buildElements(items: FavoriteVideoEntry[]): Promise<HTMLElement[]> {
    return Promise.all(items.map(item => this.buildElement(item)));
  }

  private async applyCoverSource(image: HTMLImageElement, item: FavoriteVideoEntry): Promise<void> {
    try {
      // 1. 先检查 URL 缓存
      const cachedUrl = this.coverUrlCache.get(item.videoId);
      if (cachedUrl) {
        image.src = cachedUrl;
        return;
      }

      // 2. 从数据库获取封面
      if (item.picture) {
        const coverBlob = await this.videoRepository.getVideoPicture(item.videoId);
        if (coverBlob) {
          const objectUrl = URL.createObjectURL(coverBlob);
          this.coverUrlCache.set(item.videoId, objectUrl);
          image.src = objectUrl;
          return;
        }
      }
    } catch (error) {
      console.error(`[FavoriteListElementBuilder] 加载本地封面失败 (videoId: ${item.videoId}):`, error);
    }

    this.applyRemoteCoverFallback(image, item.coverUrl);
  }

  private applyRemoteCoverFallback(image: HTMLImageElement, coverUrl?: string): void {
    if (!coverUrl) {
      image.src = DEFAULT_COVER;
      return;
    }

    image.onerror = () => {
      image.onerror = null;
      image.src = DEFAULT_COVER;
    };
    image.src = coverUrl;
  }
}
