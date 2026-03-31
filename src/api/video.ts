/**
 * 视频相关 API
 */

import type { VideoInfo, VideoTag, RelatedVideoInfo } from "./types.js";
import { apiRequest, type ApiRequestOptions } from "./request.js";
import { generateWBISign } from "./wbi.js";

/**
 * 获取视频详情
 * @param bvid BV号
 * @param aid AV号（可选）
 * @param options API请求选项
 */
export async function getVideoDetail(
  bvid?: string,
  aid?: string,
  options: ApiRequestOptions = {}
): Promise<VideoInfo | null> {
  let url = "https://api.bilibili.com/x/web-interface/view?";
  if (bvid) {
    url += `bvid=${bvid}`;
  } else if (aid) {
    url += `aid=${aid}`;
  } else {
    return null;
  }

  const data = await apiRequest<any>(url, options);
  if (!data) {
    return null;
  }

  // 将原始数据映射到 VideoInfo 结构
  return {
    bvid: data.bvid,
    title: data.title,
    pic: data.pic,
    pubdate: data.pubdate,
    duration: data.duration,
    desc: data.desc, // 添加描述字段
    owner: {
      mid: data.owner?.mid,
      name: data.owner?.name,
      face: data.owner?.face
    }
  };
}

/**
 * 获取视频标签
 * @param bvid BV号
 * @param options API请求选项
 */
export async function getVideoTagsDetail(
  bvid: string,
  options: ApiRequestOptions = {}
): Promise<VideoTag[]> {
  const url = `https://api.bilibili.com/x/tag/archive/tags?bvid=${bvid}`;
  const data = await apiRequest<VideoTag[]>(url, options);
  return data ?? [];
}

/**
 * 获取相关视频
 * @param bvid BV号
 * @param options API请求选项
 */
export async function getRelatedVideos(
  bvid: string,
  options: ApiRequestOptions = {}
): Promise<RelatedVideoInfo[]> {
  const url = `https://api.bilibili.com/x/web-interface/archive/related?bvid=${bvid}`;
  const data = await apiRequest<any[]>(url, options);
  if (!Array.isArray(data)) {
    return [];
  }

  // 将原始数据映射到 RelatedVideoInfo 结构
  return data.map((item) => ({
    bvid: item.bvid,
    title: item.title,
    pic: item.pic,
    pubdate: item.pubdate,
    duration: item.duration,
    owner: {
      mid: item.owner?.mid,
      name: item.owner?.name,
      face: item.owner?.face
    },
    aid: item.aid,
    stat: {
      view: item.stat?.view || 0,
      danmaku: item.stat?.danmaku || 0,
      reply: item.stat?.reply || 0,
      favorite: item.stat?.favorite || 0,
      coin: item.stat?.coin || 0,
      share: item.stat?.share || 0,
      like: item.stat?.like || 0
    }
  }));
}

/**
 * 获取UP视频列表（需要WBI签名）
 * @param mid UP id
 * @param pn 页码
 * @param ps 数量
 * @param options API请求选项
 */
export async function getUPVideosWithWBI(
  mid: number,
  pn = 1,
  ps = 30,
  options: ApiRequestOptions = {}
): Promise<VideoInfo[]> {
  const params = { mid, pn, ps };
  const sign = await generateWBISign(params, options);
  if (!sign) {
    return [];
  }

  const url = `https://api.bilibili.com/x/space/wbi/arc/search?mid=${mid}&pn=${pn}&ps=${ps}&w_rid=${sign.w_rid}&wts=${sign.wts}`;
  const data = await apiRequest<{ data?: { list?: { vlist?: any[] } } }>(url, options);
  const list = data?.data?.list?.vlist;
  if (!Array.isArray(list)) {
    return [];
  }

  // 将原始数据映射到 VideoInfo 结构
  return list.map((item) => ({
    bvid: item.bvid,
    title: item.title,
    pic: item.pic,
    pubdate: item.created || item.pubdate,
    duration: item.length || item.duration,
    owner: {
      mid: item.mid || mid,
      name: item.author || item.owner?.name || '',
      face: item.face || item.owner?.face || ''
    }
  }));
}
