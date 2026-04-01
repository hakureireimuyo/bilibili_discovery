/**
 * 观看统计页面主逻辑
 */

import { themeManager, initThemedPage } from '../../themes/index.js';
import { Heatmap, LineChart } from '../shared/charts/index.js';
import { StatCard } from '../shared/stats/index.js';
import type { WatchStatsData, UPStat, VideoStat } from './types.js';
import { DailyWatchStatsRepositoryImpl } from '../../database/implementations/daily-watch-stats-repository.impl.js';
import { Platform } from '../../database/types/base.js';
import { dbManager } from '../../database/indexeddb/index.js';

export class WatchStatsPage {
  private heatmap?: Heatmap;
  private lineChart?: LineChart;
  private statCards: Map<string, StatCard> = new Map();
  private dailyWatchStatsRepo: DailyWatchStatsRepositoryImpl;
  private currentView: 'month' | 'year' = 'month';
  private currentYear: number = new Date().getFullYear();
  private currentMonth: number = new Date().getMonth(); // 0-11
  private dailySeconds: Record<string, number> = {};
  private totalSeconds: number = 0;
  private lastUpdate: number = 0;

  constructor() {
    this.dailyWatchStatsRepo = new DailyWatchStatsRepositoryImpl();
    initThemedPage('watch-stats');
    this.init();
  }

  /**
   * 初始化页面
   */
  private async init(): Promise<void> {
    // 初始化图表组件
    this.initCharts();

    // 初始化统计卡片
    this.initStatCards();

    // 初始化视图控制
    this.initViewControls();

    // 注册主题变更监听器
    themeManager.addChangeListener(() => {
      this.handleThemeChange();
    });

    // 加载每日观看统计数据
    await this.loadDailyWatchStats();
  }

  /**
   * 初始化图表组件
   */
  private initCharts(): void {
    // 初始化热力图
    const heatmapContainer = document.getElementById('heatmap-container');
    if (heatmapContainer) {
      this.heatmap = new Heatmap(heatmapContainer, {
        showTodayMarker: true,
        showTooltip: true,
        viewMode: this.currentView
      });
    }

    // 初始化折线图
    const lineChartCanvas = document.getElementById('line-chart') as HTMLCanvasElement;
    if (lineChartCanvas) {
      this.lineChart = new LineChart(lineChartCanvas, {
        showPoints: true,
        showTooltip: true
      });
    }
  }

  /**
   * 初始化视图控制
   */
  private initViewControls(): void {
    // 月度视图按钮
    const btnViewMonth = document.getElementById('btn-view-month');
    if (btnViewMonth) {
      btnViewMonth.addEventListener('click', () => {
        this.switchToMonthView(this.currentYear, this.currentMonth);
        this.updateViewButtons();
      });
    }

    // 年度视图按钮
    const btnViewYear = document.getElementById('btn-view-year');
    if (btnViewYear) {
      btnViewYear.addEventListener('click', () => {
        this.switchToYearView(this.currentYear);
        this.updateViewButtons();
      });
    }

    // 上一个按钮
    const btnPrev = document.getElementById('btn-prev');
    if (btnPrev) {
      btnPrev.addEventListener('click', () => {
        if (this.currentView === 'month') {
          this.previousMonth();
        } else {
          this.previousYear();
        }
      });
    }

    // 下一个按钮
    const btnNext = document.getElementById('btn-next');
    if (btnNext) {
      btnNext.addEventListener('click', () => {
        if (this.currentView === 'month') {
          this.nextMonth();
        } else {
          this.nextYear();
        }
      });
    }

    // 初始化视图按钮状态
    this.updateViewButtons();
  }

  /**
   * 更新视图按钮状态
   */
  private updateViewButtons(): void {
    const btnViewMonth = document.getElementById('btn-view-month');
    const btnViewYear = document.getElementById('btn-view-year');

    if (btnViewMonth && btnViewYear) {
      if (this.currentView === 'month') {
        btnViewMonth.classList.add('active');
        btnViewYear.classList.remove('active');
      } else {
        btnViewMonth.classList.remove('active');
        btnViewYear.classList.add('active');
      }
    }
  }

  /**
   * 更新周期标签
   */
  private updatePeriodLabel(): void {
    const periodLabel = document.getElementById('current-period');
    if (periodLabel) {
      if (this.currentView === 'month') {
        periodLabel.textContent = `${this.currentYear}年${this.currentMonth + 1}月`;
      } else {
        periodLabel.textContent = `${this.currentYear}年`;
      }
    }
  }

  /**
   * 初始化统计卡片
   */
  private initStatCards(): void {
    const cardConfigs = [
      { id: 'stat-total', label: '总观看时长', theme: 'primary' as const },
      { id: 'stat-today', label: '今日观看时长', theme: 'accent' as const },
      { id: 'stat-7days', label: '近7天观看时长', theme: 'success' as const },
      { id: 'stat-update', label: '统计更新时间', theme: 'info' as const }
    ];

    for (const config of cardConfigs) {
      const container = document.getElementById(config.id);
      if (container) {
        const card = new StatCard(container, {
          showIcon: false,
          enableHover: true
        });
        card.render({
          label: config.label,
          value: '-',
          theme: config.theme
        });
        this.statCards.set(config.id, card);
      }
    }
  }

  /**
   * 加载每日观看统计数据
   */
  private async loadDailyWatchStats(): Promise<void> {
    try {
      // 确保数据库已初始化
      await dbManager.init();

      // 获取最近365天的统计数据
      const now = new Date();
      const endDate = new Date(now);
      const startDate = new Date(now);
      startDate.setFullYear(now.getFullYear() - 1);

      const startKey = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`;
      const endKey = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;

      // 从数据库获取统计数据
      const stats = await this.dailyWatchStatsRepo.getStatsByDateRange(
        startKey,
        endKey,
        Platform.BILIBILI
      );

      // 构建每日观看时长映射
      this.dailySeconds = {};
      this.totalSeconds = 0;
      this.lastUpdate = 0;

      for (const stat of stats) {
        this.dailySeconds[stat.dateKey] = stat.totalWatchDuration;
        this.totalSeconds += stat.totalWatchDuration;
        if (stat.updateTime > this.lastUpdate) {
          this.lastUpdate = stat.updateTime;
        }
      }

      // 根据当前视图更新UI
      await this.updateView();
    } catch (error) {
      console.error('[WatchStatsPage] 加载每日观看统计数据失败:', error);
    }
  }

  /**
   * 切换到月视图
   */
  public async switchToMonthView(year: number, month: number): Promise<void> {
    this.currentView = 'month';
    this.currentYear = year;
    this.currentMonth = month;
    if (this.heatmap) {
      this.heatmap.setViewMode('month');
    }
    await this.updateView();
  }

  /**
   * 切换到年视图
   */
  public async switchToYearView(year: number): Promise<void> {
    this.currentView = 'year';
    this.currentYear = year;
    if (this.heatmap) {
      this.heatmap.setViewMode('year');
    }
    await this.updateView();
  }

  /**
   * 切换到上一个月
   */
  public async previousMonth(): Promise<void> {
    if (this.currentMonth === 0) {
      this.currentMonth = 11;
      this.currentYear--;
    } else {
      this.currentMonth--;
    }
    await this.updateView();
  }

  /**
   * 切换到下一个月
   */
  public async nextMonth(): Promise<void> {
    if (this.currentMonth === 11) {
      this.currentMonth = 0;
      this.currentYear++;
    } else {
      this.currentMonth++;
    }
    await this.updateView();
  }

  /**
   * 切换到上一年
   */
  public async previousYear(): Promise<void> {
    this.currentYear--;
    await this.updateView();
  }

  /**
   * 切换到下一年
   */
  public async nextYear(): Promise<void> {
    this.currentYear++;
    await this.updateView();
  }

  /**
   * 更新当前视图
   */
  private async updateView(): Promise<void> {
    // 重新初始化热力图以应用新的视图模式
    this.initCharts();
    
    if (this.currentView === 'month') {
      await this.updateMonthView();
    } else {
      await this.updateYearView();
    }
  }

  /**
   * 更新月视图
   */
  private async updateMonthView(): Promise<void> {
    if (!this.heatmap) return;

    const monthDays = this.getMonthDays(this.currentYear, this.currentMonth);
    const heatmapData = monthDays.map(day => ({
      date: day.date,
      day: day.day,
      seconds: day.date ? (this.dailySeconds[day.date] ?? 0) : 0
    }));

    this.heatmap.render(heatmapData);
    this.updatePeriodLabel();
  }

  /**
   * 更新年视图
   */
  private async updateYearView(): Promise<void> {
    if (!this.heatmap) return;

    const yearDays = this.getYearDays(this.currentYear);
    const heatmapData = yearDays.map(day => ({
      date: day.date,
      day: day.day,
      seconds: day.date ? (this.dailySeconds[day.date] ?? 0) : 0
    }));

    this.heatmap.render(heatmapData);
    this.updatePeriodLabel();
  }

  /**
   * 处理主题变更
   */
  private handleThemeChange(): void {
    // 重新渲染图表以应用新主题颜色
    // 实际数据更新时会被重新渲染，这里只是预留接口
  }

  /**
   * 更新统计数据
   * 这个方法将在后续集成数据层时被调用
   */
  public updateStats(data: WatchStatsData): void {
    // 更新内部数据
    this.dailySeconds = data.dailySeconds;
    this.totalSeconds = data.totalSeconds;
    this.lastUpdate = data.lastUpdate;

    // 更新统计卡片
    this.updateStatCards(data);

    // 更新热力图
    this.updateHeatmap(data);

    // 更新折线图
    this.updateLineChart(data);
  }

  /**
   * 更新统计卡片
   */
  private updateStatCards(data: WatchStatsData): void {
    const totalCard = this.statCards.get('stat-total');
    if (totalCard) {
      totalCard.update({ value: this.formatSeconds(this.totalSeconds) });
    }

    const todayKey = this.getTodayKey();
    const todaySeconds = this.dailySeconds[todayKey] ?? 0;
    const todayCard = this.statCards.get('stat-today');
    if (todayCard) {
      todayCard.update({ value: this.formatSeconds(todaySeconds) });
    }

    const last7Days = this.getRecentDays(7);
    const total7Days = last7Days.reduce((sum, day) => sum + (this.dailySeconds[day] ?? 0), 0);
    const weekCard = this.statCards.get('stat-7days');
    if (weekCard) {
      weekCard.update({ value: this.formatSeconds(total7Days) });
    }

    const updateCard = this.statCards.get('stat-update');
    if (updateCard) {
      updateCard.update({ value: this.formatTimestamp(this.lastUpdate) });
    }
  }

  /**
   * 更新热力图
   */
  private updateHeatmap(data: WatchStatsData): void {
    // 热力图现在由 updateMonthView 和 updateYearView 方法更新
    // 这个方法保留以兼容现有代码
    if (this.currentView === 'month') {
      this.updateMonthView();
    } else {
      this.updateYearView();
    }
  }

  /**
   * 更新折线图
   */
  private updateLineChart(data: WatchStatsData): void {
    if (!this.lineChart) return;

    const recentDays = this.getRecentDays(7).reverse();
    const chartData = recentDays.map(day => {
      const date = new Date(day);
      return {
        label: `${date.getMonth() + 1}/${date.getDate()}`,
        value: this.dailySeconds[day] ?? 0
      };
    });

    this.lineChart.render(chartData);
  }

  /**
   * 更新UP主列表
   */
  public updateUPList(upStats: UPStat[]): void {
    const container = document.getElementById('up-list');
    if (!container) return;

    container.innerHTML = '';

    if (upStats.length === 0) {
      this.renderEmptyState(container);
      return;
    }

    for (const stat of upStats) {
      const item = this.createUPListItem(stat);
      container.appendChild(item);
    }
  }

  /**
   * 创建UP主列表项
   */
  private createUPListItem(stat: UPStat): HTMLElement {
    const item = document.createElement('div');
    item.className = 'list-item';

    const info = document.createElement('div');
    info.className = 'info';
    info.style.flexDirection = 'column';
    info.style.alignItems = 'flex-start';

    // 头像和名称
    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.alignItems = 'center';
    header.style.gap = '12px';
    header.style.width = '100%';

    const avatar = document.createElement('img');
    avatar.className = 'avatar';
    avatar.src = stat.info?.face || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23667eea"%3E%3Cpath d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/%3E%3C/svg%3E';
    avatar.onerror = () => {
      avatar.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23667eea"%3E%3Cpath d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/%3E%3C/svg%3E';
    };

    const name = document.createElement('div');
    name.className = 'name';
    name.textContent = stat.info?.name || `UP ${stat.mid}`;

    header.appendChild(avatar);
    header.appendChild(name);

    // 统计数据
    const stats = document.createElement('div');
    stats.style.display = 'flex';
    stats.style.flexWrap = 'wrap';
    stats.style.gap = '12px';
    stats.style.fontSize = '12px';
    stats.style.color = 'var(--theme-text-tertiary)';

    const watchCount = document.createElement('span');
    watchCount.textContent = `观看${stat.totalWatchCount}次`;
    
    const avgDuration = document.createElement('span');
    avgDuration.textContent = `平均${this.formatSeconds(stat.avgWatchDuration || 0)}`;

    const interactionRate = document.createElement('span');
    interactionRate.textContent = `互动率${(stat.interactionRate || 0).toFixed(2)}`;

    stats.appendChild(watchCount);
    stats.appendChild(avgDuration);
    stats.appendChild(interactionRate);

    // 互动统计
    const interactions = document.createElement('div');
    interactions.style.display = 'flex';
    interactions.style.gap = '8px';
    interactions.style.fontSize = '12px';
    interactions.style.color = 'var(--theme-text-tertiary)';

    if (stat.likeCount > 0) {
      const like = document.createElement('span');
      like.textContent = `👍 ${stat.likeCount}`;
      interactions.appendChild(like);
    }
    if (stat.coinCount > 0) {
      const coin = document.createElement('span');
      coin.textContent = `🪙 ${stat.coinCount}`;
      interactions.appendChild(coin);
    }
    if (stat.favoriteCount > 0) {
      const favorite = document.createElement('span');
      favorite.textContent = `⭐ ${stat.favoriteCount}`;
      interactions.appendChild(favorite);
    }
    if (stat.commentCount > 0) {
      const comment = document.createElement('span');
      comment.textContent = `💬 ${stat.commentCount}`;
      interactions.appendChild(comment);
    }

    info.appendChild(header);
    info.appendChild(stats);
    if (interactions.children.length > 0) {
      info.appendChild(interactions);
    }

    const value = document.createElement('div');
    value.className = 'value';
    value.textContent = this.formatSeconds(stat.totalWatchDuration);

    item.appendChild(info);
    item.appendChild(value);

    // 点击跳转到UP主空间
    item.addEventListener('click', () => {
      window.open(`https://space.bilibili.com/${stat.mid}`, '_blank');
    });

    return item;
  }

  /**
   * 更新视频列表
   */
  public updateVideoList(videoStats: VideoStat[]): void {
    const container = document.getElementById('video-list');
    if (!container) return;

    container.innerHTML = '';

    if (videoStats.length === 0) {
      this.renderEmptyState(container);
      return;
    }

    for (const stat of videoStats) {
      const item = this.createVideoListItem(stat);
      container.appendChild(item);
    }
  }

  /**
   * 创建视频列表项
   */
  private createVideoListItem(stat: VideoStat): HTMLElement {
    const item = document.createElement('div');
    item.className = 'list-item';

    const info = document.createElement('div');
    info.className = 'info';

    const title = document.createElement('div');
    title.className = 'name';
    title.textContent = stat.info?.title || stat.bvid;

    const detail = document.createElement('div');
    detail.className = 'detail';
    detail.textContent = stat.info?.duration ? this.formatSeconds(stat.info.duration) : '-';

    info.appendChild(title);
    info.appendChild(detail);

    const value = document.createElement('div');
    value.className = 'value';
    value.textContent = this.formatSeconds(stat.seconds);

    item.appendChild(info);
    item.appendChild(value);

    // 点击跳转到视频页面
    item.addEventListener('click', () => {
      window.open(`https://www.bilibili.com/video/${stat.bvid}`, '_blank');
    });

    return item;
  }

  /**
   * 渲染空状态
   */
  private renderEmptyState(container: HTMLElement): void {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = '暂无数据';
    container.appendChild(empty);
  }

  /**
   * 格式化秒数为 HH:MM:SS 格式
   */
  private formatSeconds(total: number): string {
    const safe = Math.max(0, Math.floor(total));
    const hours = Math.floor(safe / 3600);
    const minutes = Math.floor((safe % 3600) / 60);
    const seconds = safe % 60;
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  /**
   * 格式化时间戳
   */
  private formatTimestamp(timestamp: number): string {
    if (!timestamp) return '-';
    const date = new Date(timestamp);
    return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  }

  /**
   * 获取今天的日期键
   */
  private getTodayKey(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }

  /**
   * 获取最近N天的日期列表
   */
  private getRecentDays(count: number): string[] {
    const days: string[] = [];
    const now = new Date();
    for (let i = 0; i < count; i++) {
      const date = new Date(now);
      date.setDate(now.getDate() - i);
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      days.push(`${date.getFullYear()}-${month}-${day}`);
    }
    return days;
  }

  /**
   * 获取指定月份的日期列表
   */
  private getMonthDays(year: number, month: number): Array<{ date: string; day: number }> {
    const days: Array<{ date: string; day: number }> = [];
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    // 获取月份的第一天是星期几（0-6，0是周日）
    const startDayOfWeek = firstDay.getDay();

    // 添加空白单元格填充
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push({ date: '', day: 0 });
    }

    // 添加日期
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({ date: dateStr, day: d });
    }

    return days;
  }

  /**
   * 获取指定年份的日期列表
   */
  private getYearDays(year: number): Array<{ date: string; day: number }> {
    const days: Array<{ date: string; day: number }> = [];

    // 遍历一年的12个月
    for (let month = 0; month < 12; month++) {
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);

      // 获取月份的第一天是星期几（0-6，0是周日）
      const startDayOfWeek = firstDay.getDay();

      // 添加空白单元格填充
      for (let i = 0; i < startDayOfWeek; i++) {
        days.push({ date: '', day: 0 });
      }

      // 添加日期
      for (let d = 1; d <= lastDay.getDate(); d++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        days.push({ date: dateStr, day: d });
      }
    }

    return days;
  }

  /**
   * 销毁页面
   */
  public destroy(): void {
    this.heatmap?.destroy();
    this.lineChart?.destroy();
    this.statCards.forEach(card => card.destroy());
    this.statCards.clear();
  }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', async () => {
  const page = new WatchStatsPage();

  // 页面卸载时清理
  window.addEventListener('beforeunload', () => {
    page.destroy();
  });

  // 将页面实例暴露到全局，方便后续集成数据层
  (window as any).watchStatsPage = {
    switchToMonthView: (year: number, month: number) => page.switchToMonthView(year, month),
    switchToYearView: (year: number) => page.switchToYearView(year),
    previousMonth: () => page.previousMonth(),
    nextMonth: () => page.nextMonth(),
    previousYear: () => page.previousYear(),
    nextYear: () => page.nextYear(),
    updateStats: (data: WatchStatsData) => page.updateStats(data),
    getCurrentView: () => ({
      view: page['currentView'],
      year: page['currentYear'],
      month: page['currentMonth']
    })
  };
});
