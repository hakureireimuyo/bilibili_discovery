# `src/background/modules`

本目录承载后台核心业务模块，是后台能力的主要实现层。

主要职责：
- 响应来自 popup、content script、页面的消息
- 执行关注列表更新、自动分类、观看统计等后台任务
- 协调 `api`、`engine`、`database` 三层

设计边界：
- 这里负责业务流程编排
- 数据持久化应通过 `database/implementations`
- 算法、打分、LLM 分类逻辑应尽量交给 `engine`

主要文件：
- `messages.ts`：后台消息总入口
- `up-list.ts`：关注列表更新任务
- `classify-api.ts`：通过 API 数据进行分类
- `classify-page.ts`：通过页面采集数据进行分类
- `classify-progress.ts`：分类进度消息发送工具
- `watch-stats.ts`：观看统计写入与聚合
- `alarms.ts`：定时任务注册
- `proxy.ts`：接口代理请求
- `common-types.ts`：后台模块共享类型
