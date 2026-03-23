/* 
 * messages.ts 功能说明
 * 
 * 该文件负责处理来自前端和其他模块的消息请求，包括以下主要功能：
 * 
 * 1. 导入依赖
 *    - bili-api: B站API相关函数 (getUPInfo, getUPVideos, getVideoTags, getVideoDetail, getVideoTagsDetail)
 *    - recommender: 推荐系统相关函数 (randomUP, randomVideo, recommendUP, recommendVideo, updateInterestFromWatch)
 *    - database: 数据库相关函数和类型
 *    - classify-api: UP主分类任务
 *    - classify-page: 页面分类相关功能 (handleUPPageCollected, getPageClassifyProgress, startAutoClassification, stopAutoClassification)
 *    - up-list: UP列表更新任务
 *    - proxy: 代理API请求
 *    - watch-stats: 观看统计相关功能 (updateWatchStats, initializeVideoInfo, processUPInfo, processVideoTags)
 *    - interest-manager: 兴趣管理器
 *    - favorite-sync: 收藏夹同步功能 (syncFavoriteVideos, searchFavoriteVideos)
 *    - CollectionRepository, VideoRepository, CreatorRepository, TagRepository, CollectionItemRepository: 数据仓库
 * 
 * 2. 全局变量
 *    - shouldStopSync: 控制是否停止同步的标志
 *    - syncProgressState: 同步进度状态 (active, current, total, title, detail, stopping)
 * 
 * 3. 辅助函数
 *    - sendSyncProgress(): 发送同步进度消息
 * 
 * 4. 主函数 handleMessage(message, options)
 *    处理各种类型的消息：
 *    
 *    a. 观看相关消息
 *       - "watch_event": 处理观看事件，更新兴趣模型
 *       - "watch_progress": 处理观看进度，更新观看统计和兴趣
 *       - "initialize_video_info": 初始化视频信息
 *       - "process_up_info": 处理UP主信息
 *       - "process_video_tags": 处理视频标签
 *    
 *    b. 用户相关消息
 *       - "detect_uid": 检测并更新用户ID
 *       - "get_value": 获取存储的值
 *    
 *    c. 导航相关消息
 *       - "random_up": 随机跳转到一个UP主页面
 *       - "random_video": 随机跳转到一个视频页面
 *       - "recommend_video": 推荐并跳转到一个视频页面
 *    
 *    d. UP主列表相关消息
 *       - "update_up_list": 更新UP主列表
 *       - "follow_status_changed": 处理关注状态变更
 *    
 *    e. 分类相关消息
 *       - "classify_ups": 执行UP主分类任务
 *       - "start_auto_classification": 启动自动分类
 *       - "stop_auto_classification": 停止自动分类
 *       - "up_page_collected": 处理UP主页面数据收集
 *       - "clear_classify_data": 清除分类数据
 *       - "get_classify_progress": 获取分类进度
 *       - "probe_up": 探测UP主信息
 *    
 *    f. 兴趣系统相关消息
 *       - "get_interest_stats": 获取兴趣统计
 *       - "initialize_interest_system": 初始化兴趣系统
 *       - "run_daily_interest_task": 执行每日兴趣任务
 *       - "run_weekly_interest_task": 执行每周兴趣任务
 *       - "run_monthly_interest_task": 执行每月兴趣任务
 *    
 *    g. 收藏夹相关消息
 *       - "sync_favorite_videos": 同步收藏视频
 *       - "search_favorite_videos": 搜索收藏视频
 *       - "get_collections": 获取所有收藏夹
 *       - "get_should_stop_sync": 获取是否应停止同步
 *       - "get_sync_progress": 获取同步进度
 *       - "set_should_stop_sync": 设置是否应停止同步
 *    
 *    h. 已注释的功能 (待重新实现)
 *       - "favorite_action": 处理收藏操作 (添加/移除)
 *       - "get_collection_videos": 获取收藏夹视频
 *       - "get_collection_videos_paginated": 分页获取收藏夹视频
 *       - "get_all_collection_videos": 获取所有收藏夹视频
 *       - "get_all_collection_videos_paginated": 分页获取所有收藏夹视频
 *       - "get_collection_tags": 获取收藏夹标签
 *       - "get_all_collection_tags": 获取所有收藏夹标签
 * 
 * 5. 功能流程
 *    a. 观看事件处理流程:
 *       1. 接收观看事件消息
 *       2. 获取视频标签
 *       3. 更新兴趣模型
 *       4. 更新观看统计
 *       5. 触发兴趣计算
 *    
 *    b. UP主分类流程:
 *       1. 检查分类方法设置 (API或页面抓取)
 *       2. 根据方法执行分类任务
 *       3. 处理UP主页面数据收集
 *       4. 更新分类进度
 *    
 *    c. 收藏夹同步流程:
 *       1. 重置同步状态
 *       2. 创建停止检查函数
 *       3. 执行同步任务
 *       4. 更新同步进度
 *       5. 发送完成消息
 * 
 * 6. 数据存储
 *    - upManualTagsCache: UP主手动标签缓存
 *    - upTagWeightsCache: UP主标签权重缓存
 *    - videoCounts: 视频计数
 *    - classifyStatus: 分类状态
 *    - settings: 用户设置 (包括userId, classifyMethod等)
 *    - userId: 用户ID
 * 
 * 7. 错误处理
 *    - 对每种消息类型都进行了参数验证
 *    - 捕获并记录异常
 *    - 返回错误信息给调用方
 * 
 * 8. Chrome API交互
 *    - 使用chrome.runtime.sendMessage发送消息
 *    - 使用chrome.tabs进行标签页操作
 *    - 处理popup关闭等边界情况
 */
