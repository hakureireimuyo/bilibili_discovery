/**
 * 数据库统计管理器
 * 负责管理数据库统计页面的核心功能
 */

import { VideoRepositoryImpl } from "../../database/implementations/video-repository.impl.js";
import { CreatorRepositoryImpl } from "../../database/implementations/creator-repository.impl.js";
import { CollectionRepositoryImpl } from "../../database/implementations/collection-repository.impl.js";
import { TagRepositoryImpl } from "../../database/implementations/tag-repository.impl.js";
import { DBUtils, STORE_NAMES } from "../../database/indexeddb/index.js";
import { getFavoriteFolders, getCollectedFolders } from "../../api/favorite.js";
import { getFollowedUPs, getUPSeasonSeries, getFollowStat } from "../../api/user.js";
import { getVideoTagsDetail } from "../../api/video.js";
import type { SubscribedFavoriteFolderInfo, FavoriteFolderInfo, FollowingUp } from "../../api/types.js";
import { getValue } from "../../database/implementations/settings-repository.impl.js";
import { FolderProcessor } from "./folder-processor.js";
import { showProgress, hideProgress, showStatus, updateStatValue, updateFetchButtonState, showUPProgress, hideUPProgress, updateUPFetchButtonState, showUPDetailProgress, hideUPDetailProgress } from "./ui-helper.js";
import type { ProgressCallback } from "./types.js";
import { RateLimitError } from "../../api/request.js";
import type { Creator } from "../../database/types/creator.js";
import { Platform,TagSource } from "../../database/types/base.js";

/**
 * 数据库统计管理器类
 */
export class DatabaseStatsManager {
  private videoRepo: VideoRepositoryImpl;
  private creatorRepo: CreatorRepositoryImpl;
  private collectionRepo: CollectionRepositoryImpl;
  private tagRepo: TagRepositoryImpl;
  private folderProcessor: FolderProcessor;
  private isFetching: boolean = false;
  private isPaused: boolean = false;
  private abortController: AbortController | null = null;
  private isFetchingUP: boolean = false;
  private isPausedUP: boolean = false;
  private abortControllerUP: AbortController | null = null;

  constructor() {
    this.videoRepo = new VideoRepositoryImpl();
    this.creatorRepo = new CreatorRepositoryImpl();
    this.collectionRepo = new CollectionRepositoryImpl();
    this.tagRepo = new TagRepositoryImpl();
    this.folderProcessor = new FolderProcessor();
  }

  /**
   * 初始化页面
   */
  async init(): Promise<void> {
    if (typeof document === "undefined") {
      return;
    }

    // 初始化主题
    import("../../themes/index.js").then(({ initThemedPage }) => {
      initThemedPage("database-stats");
    });

    // 加载统计数据
    await this.loadStats();

    // 绑定获取收藏夹按钮事件
    this.bindFetchButton();

    // 绑定获取UP主按钮事件
    this.bindUPFetchButton();
  }

  /**
   * 绑定获取收藏夹按钮事件
   */
  private bindFetchButton(): void {
    const fetchBtn = document.getElementById('fetch-favorites-btn');
    if (fetchBtn) {
      fetchBtn.addEventListener('click', async () => {
        if (this.isFetching) {
          // 暂停获取
          this.isPaused = true;
          if (this.abortController) {
            this.abortController.abort();
          }
          showStatus('已暂停获取', 'info');
          return;
        }

        // 从设置中获取UID
        const userId = await getValue<number>("userId");
        if (!userId) {
          showStatus('请先在设置中配置用户UID', 'error');
          return;
        }

        await this.fetchFavoriteData(userId.toString());
      });
    }
  }

  /**
   * 获取收藏夹数据
   */
  private async fetchFavoriteData(uid: string): Promise<void> {
    this.isFetching = true;
    this.isPaused = false;
    this.abortController = new AbortController();

    updateFetchButtonState(true);

    try {
      showProgress(0, 100, '正在获取收藏夹列表...');
      const folders = await getFavoriteFolders(uid);
      const collectedFolders = await getCollectedFolders(uid);
      const allFolders = [...folders, ...collectedFolders];

      if (allFolders.length === 0) {
        showStatus('未找到收藏夹', 'error');
        hideProgress();
        return;
      }

      let totalVideos = 0;
      let processedFolders = 0;

      for (const folder of allFolders) {
        if (this.isPaused) {
          showStatus(`已暂停，已处理 ${processedFolders} 个收藏夹`, 'info');
          break;
        }

        showProgress(
          processedFolders,
          allFolders.length,
          `正在处理收藏夹: ${folder.title} (${folder.media_count}个视频)`
        );

        // 判断是自己的收藏夹还是订阅的收藏夹
        if ('intro' in folder) {
          // 订阅的收藏夹
          await this.folderProcessor.processCollectedFolder(folder as SubscribedFavoriteFolderInfo, (current, total, message) => {
            const folderProgress = (processedFolders / allFolders.length) * 100;
            const videoProgress = (current / total) * (100 / allFolders.length);
            const totalProgress = folderProgress + videoProgress;
            showProgress(
              Math.floor(totalProgress),
              100,
              `[订阅 ${processedFolders + 1}/${allFolders.length}] ${folder.title}: ${message} (${current}/${total})`
            );
          }, this.abortController.signal);
        } else {
          // 自己的收藏夹
          await this.folderProcessor.processFolder(folder as FavoriteFolderInfo, (current, total, message) => {
            const folderProgress = (processedFolders / allFolders.length) * 100;
            const videoProgress = (current / total) * (100 / allFolders.length);
            const totalProgress = folderProgress + videoProgress;
            showProgress(
              Math.floor(totalProgress),
              100,
              `[${processedFolders + 1}/${allFolders.length}] ${folder.title}: ${message} (${current}/${total})`
            );
          }, this.abortController.signal);
        }

        if (this.isPaused) {
          break;
        }

        processedFolders++;
        totalVideos += folder.media_count;
      }

      if (!this.isPaused) {
        showProgress(100, 100, '完成！');
        showStatus(`成功处理 ${folders.length} 个收藏夹和 ${collectedFolders.length} 个订阅收藏夹，共 ${totalVideos} 个视频`, 'success');
        // 重新加载统计数据
        await this.loadStats();
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        showStatus('已取消获取', 'info');
      } else if (error instanceof RateLimitError) {
        console.error('[DatabaseStatsManager] 触发风控:', error);
        showStatus(error.message, 'error');
      } else {
        console.error('[DatabaseStatsManager] 获取收藏夹数据失败:', error);
        showStatus('获取收藏夹数据失败: ' + (error instanceof Error ? error.message : '未知错误'), 'error');
      }
    } finally {
      this.isFetching = false;
      this.isPaused = false;
      this.abortController = null;
      updateFetchButtonState(false);
      setTimeout(() => hideProgress(), 2000);
    }
  }

  /**
   * 加载统计数据
   */
  private async loadStats(): Promise<void> {
    try {
      // 获取视频总数
      const videos = await this.videoRepo.getAllVideos();
      const videoCount = videos.length;

      // 获取UP主总数
      const creators = await this.creatorRepo.getAll();
      const creatorCount = creators.length;

      // 获取收藏夹总数
      const collections = await this.collectionRepo.getAllCollections();
      const collectionCount = collections.length;

      // 获取收藏项总数
      const collectionItems = await DBUtils.getAll(STORE_NAMES.COLLECTION_ITEMS);
      const collectionItemCount = collectionItems.length;

      // 获取标签总数
      const tagResult = await this.tagRepo.getAllTags();
      const tagCount = tagResult.total;

      // 获取分类总数
      const categories = await DBUtils.getAll(STORE_NAMES.CATEGORIES);
      const categoryCount = categories.length;

      // 更新UI
      updateStatValue('stat-video-count', videoCount);
      updateStatValue('stat-creator-count', creatorCount);
      updateStatValue('stat-collection-count', collectionCount);
      updateStatValue('stat-collection-item-count', collectionItemCount);
      updateStatValue('stat-tag-count', tagCount);
      updateStatValue('stat-category-count', categoryCount);

      showStatus('数据加载完成', 'success');
    } catch (error) {
      console.error('[DatabaseStatsManager] 加载统计数据失败:', error);
      showStatus('加载数据失败: ' + (error instanceof Error ? error.message : '未知错误'), 'error');
    }
  }

  /**
   * 绑定获取UP主按钮事件
   */
  private bindUPFetchButton(): void {
    const fetchBtn = document.getElementById('fetch-ups-btn');
    if (fetchBtn) {
      fetchBtn.addEventListener('click', async () => {
        if (this.isFetchingUP) {
          // 暂停获取
          this.isPausedUP = true;
          if (this.abortControllerUP) {
            this.abortControllerUP.abort();
          }
          showStatus('已暂停获取UP主', 'info');
          return;
        }

        // 从设置中获取UID
        const userId = await getValue<number>("userId");
        if (!userId) {
          showStatus('请先在设置中配置用户UID', 'error');
          return;
        }

        await this.fetchUPData(userId.toString());
      });
    }
  }

  /**
   * 获取UP主数据
   */
  private async fetchUPData(uid: string): Promise<void> {
    this.isFetchingUP = true;
    this.isPausedUP = false;
    this.abortControllerUP = new AbortController();

    updateUPFetchButtonState(true);

    try {
      // 先获取总关注数
      const statInfo = await getFollowStat(parseInt(uid));
      const totalFollowing = statInfo?.following || 0;

      showUPProgress(0, totalFollowing || 100, '正在获取已关注UP主列表...');

      const allUPs: FollowingUp[] = [];
      let page = 1;
      let hasMore = true;

      // 分页获取所有已关注的UP主（使用第一个进度条）
      while (hasMore && !this.isPausedUP) {
        const { upList, hasMore: more } = await getFollowedUPs(
          parseInt(uid),
          page,
          50
        );

        allUPs.push(...upList);
        hasMore = more;

        // 更新第一个进度条
        showUPProgress(
          allUPs.length,
          totalFollowing || 100,
          `正在获取UP主列表: 已获取 ${allUPs.length}${totalFollowing > 0 ? `/${totalFollowing}` : ''} 个UP主...`
        );

        page++;

        // 添加延迟避免触发风控
        if (hasMore) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      if (this.isPausedUP) {
        showStatus(`已暂停，已获取 ${allUPs.length} 个UP主`, 'info');
        hideUPProgress();
        hideUPDetailProgress();
        return;
      }

      if (allUPs.length === 0) {
        showStatus('未找到已关注的UP主', 'error');
        hideUPProgress();
        hideUPDetailProgress();
        return;
      }

      // 处理每个UP主的信息（使用第二个进度条）
      let processedCount = 0;
      let startTime = Date.now();

      showUPDetailProgress(0, allUPs.length, '开始处理UP主详细信息...');

      for (const up of allUPs) {
        if (this.isPausedUP) {
          showStatus(`已暂停，已处理 ${processedCount} 个UP主`, 'info');
          break;
        }

        // 计算已处理经过的时间
        const elapsedTime = Date.now() - startTime;
        const elapsedSeconds = Math.floor(elapsedTime / 1000);

        // 格式化已用时间
        let timeStr = '';
        if (elapsedSeconds >= 60) {
          const minutes = Math.floor(elapsedSeconds / 60);
          const seconds = elapsedSeconds % 60;
          timeStr = `${minutes}分${seconds}秒`;
        } else {
          timeStr = `${elapsedSeconds}秒`;
        }

        // 更新第二个进度条（显示当前正在处理的UP主和已用时间）
        showUPDetailProgress(
          processedCount,
          allUPs.length,
          `正在处理UP主: ${up.uname} (${processedCount + 1}/${allUPs.length}) - 已用: ${timeStr}`
        );

        try {
          // 检查UP主是否已存在
          const existingCreator = await this.creatorRepo.getCreator(up.mid);
          
          // 如果UP主已存在且标签数量大于5个，则跳过
          if (existingCreator && existingCreator.tagWeights.length > 5) {
            console.log(`[DatabaseStatsManager] UP主 ${up.uname} 已存在且标签数量(${existingCreator.tagWeights.length})大于5，跳过`);
            processedCount++;
            continue;
          }

          // 构建Creator对象（只使用关注列表API返回的基本信息）
          // 暂时只保存头像URL，不下载头像图片
          const creator: Creator = {
            creatorId: up.mid,
            platform: Platform.BILIBILI,
            name: up.uname,
            avatar: 0, // 暂时设置为0，后续可以下载头像
            avatarUrl: up.face,
            isLogout: 0,
            description: '',
            createdAt: Date.now(),
            followTime: Date.now(),
            isFollowing: 1,
            tagWeights: [],
            updatedAt: Date.now()
          };

          // 如果UP主不存在,先保存到数据库
          if (!existingCreator) {
            await this.creatorRepo.upsertCreator(creator);
          }

          // 获取UP主的视频系列列表
          try {
            // 获取视频获取数量设置
            const maxVideosToFetch = await getValue<number>('maxVideosToFetch') ?? 3;
            const videos = await getUPSeasonSeries(up.mid, 1, maxVideosToFetch);
            
            // 获取标签获取间隔设置
            const tagFetchInterval = await getValue<number>('tagFetchInterval') ?? 20;
            
            // 为每个视频获取标签
            for (const video of videos) {
              try {
                const tags = await getVideoTagsDetail(video.bvid);
                
                // 将标签添加到UP主
                for (const tag of tags) {
                  try {
                    // 创建或获取标签
                    const tagId = await this.tagRepo.createTagWithId(tag.tag_id, tag.tag_name,TagSource.SYSTEM);
                    
                    // 添加标签到UP主
                    await this.creatorRepo.addTag(up.mid, {
                      tagId,
                      name: tag.tag_name,
                      source: TagSource.SYSTEM,
                    });
                  } catch (tagError) {
                    console.error(`[DatabaseStatsManager] 添加标签失败: ${tag.tag_name}`, tagError);
                  }
                }
                
                // 添加延迟避免触发风控
                await new Promise(resolve => setTimeout(resolve, tagFetchInterval));
              } catch (videoError) {
                console.error(`[DatabaseStatsManager] 获取视频标签失败: ${video.bvid}`, videoError);
                throw videoError; // 重新抛出错误以触发外层catch
              }
            }
          } catch (videoListError) {
            console.error(`[DatabaseStatsManager] 获取UP主视频列表失败: ${up.uname}`, videoListError);
            throw videoListError; // 重新抛出错误以触发外层catch
          }

          // 注意: 每个UP主在添加标签时已经通过addTag方法保存到数据库,这里不需要再保存

          processedCount++;
        } catch (error) {
          console.error(`[DatabaseStatsManager] 处理UP主失败: ${up.uname}`, error);
          // 如果是API错误，直接结束并返回警告
          if (error instanceof Error && (error.message.includes('403') || error.message.includes('风控'))) {
            showStatus(`API错误: ${error.message}，已停止获取UP主数据`, 'error');
            break;
          }
        }
      }

      if (!this.isPausedUP) {
        showUPDetailProgress(allUPs.length, allUPs.length, '完成！');
        showStatus(`成功处理 ${processedCount} 个UP主`, 'success');
        // 重新加载统计数据
        await this.loadStats();
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        showStatus('已取消获取UP主', 'info');
      } else if (error instanceof RateLimitError) {
        console.error('[DatabaseStatsManager] 触发风控:', error);
        showStatus(error.message, 'error');
      } else {
        console.error('[DatabaseStatsManager] 获取UP主数据失败:', error);
        showStatus('获取UP主数据失败: ' + (error instanceof Error ? error.message : '未知错误'), 'error');
      }
    } finally {
      this.isFetchingUP = false;
      this.isPausedUP = false;
      this.abortControllerUP = null;
      updateUPFetchButtonState(false);
      setTimeout(() => {
        hideUPProgress();
        hideUPDetailProgress();
      }, 2000);
    }
  }
}
