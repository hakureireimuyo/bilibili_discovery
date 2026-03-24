import type { FavoritesState, AggregatedCollectionVideo } from "./types.js";
import { formatDuration, colorFromTag } from "./helpers.js";
import { createLink } from "./dom.js";
import { buildUserSpaceUrl, buildSearchUrl, buildVideoUrl } from "../../utls/url-builder.js";
import { getTagsByIds } from "../../query/tag/index.js";

type RefreshFn = () => void;

// 标签名称缓存
const tagNameCache = new Map<string, string>();

/**
 * 获取标签名称
 * 通过查询层获取标签数据
 */
async function getTagName(tagId: string): Promise<string> {
  const cached = tagNameCache.get(tagId);
  if (cached) {
    return cached;
  }

  try {
    const tag = await getTagsByIds([tagId]);
    const tagName = tag.get(tagId)?.name || tagId;
    tagNameCache.set(tagId, tagName);
    return tagName;
  } catch (error) {
    console.warn('[VideoList] Error getting tag name:', error);
    return tagId;
  }
}

export async function createVideoCard(
  video: AggregatedCollectionVideo
): Promise<HTMLElement> {
  const card = document.createElement("div");
  card.className = "video-card";

  // 封面
  const coverLink = createLink(buildVideoUrl(video.videoId));
  const cover = document.createElement("div");
  cover.className = "video-cover";

  const img = document.createElement("img");
  img.alt = video.title;
  // TODO: 添加封面图片懒加载逻辑
  // bindCoverImageWithLazyLoad(img, video);

  cover.appendChild(img);
  coverLink.appendChild(cover);
  card.appendChild(coverLink);

  // 信息
  const info = document.createElement("div");
  info.className = "video-info";

  // 标题
  const titleLink = createLink(
    buildVideoUrl(video.videoId),
    video.title,
    "video-title"
  );
  info.appendChild(titleLink);

  // 描述
  const desc = document.createElement("div");
  desc.className = "video-description";
  desc.textContent =
    video.description.substring(0, 100) +
    (video.description.length > 100 ? "..." : "");
  info.appendChild(desc);

  // 元信息
  const meta = document.createElement("div");
  meta.className = "video-meta";

  meta.appendChild(document.createTextNode("创作者: "));
  meta.appendChild(
    createLink(
     buildUserSpaceUrl(video.creatorId),
      video.creatorName || video.creatorId
    )
  );

  meta.appendChild(
    document.createTextNode(
      ` | 时长: ${formatDuration(video.duration)}`
    )
  );

  info.appendChild(meta);

  // 标签
  if (video.tags?.length) {
    const tags = document.createElement("div");
    tags.className = "video-tags";

    const tagElements = await Promise.all(
      video.tags.map(async (tagId) => {
        const tagName = await getTagName(tagId);

        const tagLink = createLink(
          buildSearchUrl(tagName),
          tagName,
          "video-tag tag-pill"
        );

        tagLink.style.backgroundColor = colorFromTag(tagName);
        tagLink.draggable = true;

        tagLink.addEventListener("dragstart", (e) => {
          e.dataTransfer?.setData("application/x-bili-tag", tagId);
        });

        return tagLink;
      })
    );

    tagElements.forEach((t) => tags.appendChild(t));
    info.appendChild(tags);
  }

  card.appendChild(info);
  return card;
}

export async function renderVideos(
  state: FavoritesState,
  elements: Record<string, HTMLElement | null>
): Promise<void> {
  if (elements.videoList) {
    elements.videoList.innerHTML = "";
  }

  // 使用aggregatedVideos，因为loadCollectionData已经返回了当前页的数据
  const pageVideos = state.aggregatedVideos;

  if (pageVideos.length === 0) {
    elements.empty && (elements.empty.style.display = "block");
    elements.pagination && (elements.pagination.style.display = "none");
    return;
  }

  elements.empty && (elements.empty.style.display = "none");

  await Promise.all(
    pageVideos.map(async (video) => {
      const card = await createVideoCard(video);
      elements.videoList?.appendChild(card);
    })
  );
}

export async function changePage(
  state: FavoritesState,
  delta: number,
  refresh: RefreshFn
): Promise<void> {
  const totalPages = Math.ceil(
    state.total / state.pageSize
  );

  const newPage = state.currentPage + delta;
  if (newPage < 0 || newPage >= totalPages) return;

  state.currentPage = newPage;
  await refresh();
}
