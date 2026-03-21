# `src/background`

本目录存放扩展后台运行入口与后台生命周期相关代码。

主要职责：
- 启动 service worker
- 注册消息监听、定时任务、后台能力入口
- 将后台主流程拆分到 `modules/` 中实现

使用约定：
- 这里更偏“入口与装配”
- 具体功能逻辑尽量下沉到 `background/modules`

主要文件：
- `service-worker.ts`：唯一后台入口，负责监听注册与模块装配
