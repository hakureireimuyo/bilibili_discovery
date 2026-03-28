
/**
 * 统计页面入口
 * 使用StatsManager管理所有功能
 */

import { getStatsManager } from "./StatsManager.js";
import { initThemedPage } from "../../themes/index.js";

/**
 * 初始化统计页面
 * 使用StatsManager管理所有功能
 */
export async function initStats(): Promise<void> {
  initThemedPage("stats");
  await getStatsManager().init();
}

// 页面加载完成后自动初始化
// StatsManager会自动处理初始化逻辑
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => void initStats());
  } else {
    void initStats();
  }
}

