/**
 * 热力图组件
 * 用于展示月度观看数据的热力图
 */

import type { HeatmapDataPoint, HeatmapOptions } from './types.js';

export class Heatmap {
  private container: HTMLElement;
  private options: Required<HeatmapOptions>;
  private todayKey: string;

  constructor(container: HTMLElement | string, options: HeatmapOptions = {}) {
    this.container = typeof container === 'string' 
      ? document.getElementById(container)! 
      : container;

    // 设置默认选项
    this.options = {
      maxSeconds: options.maxSeconds ?? 8 * 3600, // 默认8小时
      showTodayMarker: options.showTodayMarker ?? true,
      showTooltip: options.showTooltip ?? true,
      onCellClick: options.onCellClick ?? (() => {}),
      viewMode: options.viewMode ?? 'month'
    };

    // 获取今天的日期
    const now = new Date();
    this.todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }

  /**
   * 设置视图模式
   */
  setViewMode(mode: 'month' | 'year'): void {
    this.options.viewMode = mode;
  }

  /**
   * 渲染热力图
   */
  render(data: HeatmapDataPoint[]): void {
    this.container.innerHTML = '';

    // 计算最大值（如果未指定）
    const maxSeconds = this.options.maxSeconds || Math.max(...data.map(d => d.seconds), 1);

    if (this.options.viewMode === 'year') {
      this.renderYearView(data, maxSeconds);
    } else {
      this.renderMonthView(data, maxSeconds);
    }
  }

  /**
   * 渲染月度视图
   */
  private renderMonthView(data: HeatmapDataPoint[], maxSeconds: number): void {
    // 创建热力图网格
    const grid = document.createElement('div');
    grid.className = 'heatmap-grid';
    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = 'repeat(7, 1fr)';
    grid.style.gap = '6px';

    // 渲染每个数据点
    for (const point of data) {
      const cell = this.createCell(point, maxSeconds);
      grid.appendChild(cell);
    }

    this.container.appendChild(grid);
  }

  /**
   * 渲染年度视图
   */
  private renderYearView(data: HeatmapDataPoint[], maxSeconds: number): void {
    // 创建年度视图容器
    const yearContainer = document.createElement('div');
    yearContainer.className = 'heatmap-year-grid';

    // 按月份分组数据
    const monthData: HeatmapDataPoint[][] = Array.from({ length: 12 }, () => []);
    for (const point of data) {
      if (point.date) {
        const month = parseInt(point.date.split('-')[1]) - 1;
        monthData[month].push(point);
      }
    }

    // 渲染每个月份
    const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
    for (let i = 0; i < 12; i++) {
      const monthBlock = this.createMonthBlock(monthNames[i], monthData[i], maxSeconds);
      yearContainer.appendChild(monthBlock);
    }

    this.container.appendChild(yearContainer);
  }

  /**
   * 创建月份块
   */
  private createMonthBlock(monthName: string, data: HeatmapDataPoint[], maxSeconds: number): HTMLElement {
    const block = document.createElement('div');
    block.className = 'heatmap-month-block';

    // 添加月份标题
    const title = document.createElement('div');
    title.className = 'heatmap-month-title';
    title.textContent = monthName;
    block.appendChild(title);

    // 创建月份热力图网格
    const grid = document.createElement('div');
    grid.className = 'heatmap-month-grid';
    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = 'repeat(7, 1fr)';
    grid.style.gap = '2px';

    // 渲染该月的每个数据点
    for (const point of data) {
      const cell = this.createCell(point, maxSeconds);
      cell.classList.add('heatmap-cell-compact');
      grid.appendChild(cell);
    }

    block.appendChild(grid);
    return block;
  }

  /**
   * 创建热力图单元格
   */
  private createCell(point: HeatmapDataPoint, maxSeconds: number): HTMLElement {
    const cell = document.createElement('div');
    cell.className = 'heatmap-cell';

    // 设置背景色
    if (point.date) {
      const ratio = Math.min(point.seconds / maxSeconds, 1);
      cell.style.backgroundColor = this.getHeatmapColor(ratio);
      cell.textContent = String(point.day);

      // 标记今天
      if (this.options.showTodayMarker && point.date === this.todayKey) {
        cell.style.border = '2px solid var(--theme-warning)';
        cell.style.boxShadow = `0 0 8px var(--theme-shadow-light)`;
      }

      // 添加点击事件
      cell.addEventListener('click', () => {
        this.options.onCellClick(point.date, point.seconds);
      });

      // 添加提示框
      if (this.options.showTooltip) {
        const tooltip = this.createTooltip(point);
        cell.appendChild(tooltip);
        
        // 悬停显示提示框
        cell.addEventListener('mouseenter', () => {
          tooltip.style.opacity = '1';
          tooltip.style.visibility = 'visible';
        });
        cell.addEventListener('mouseleave', () => {
          tooltip.style.opacity = '0';
          tooltip.style.visibility = 'hidden';
        });
      }
    }

    return cell;
  }

  /**
   * 创建提示框
   */
  private createTooltip(point: HeatmapDataPoint): HTMLElement {
    const tooltip = document.createElement('div');
    tooltip.className = 'heatmap-tooltip';
    tooltip.textContent = `${point.date}: ${this.formatSeconds(point.seconds)}`;

    return tooltip;
  }

  /**
   * 获取热力图颜色
   */
  private getHeatmapColor(ratio: number): string {
    // 使用主题中的热力图颜色
    const colors = [
      'var(--theme-heatmap-level0)', // 0%
      'var(--theme-heatmap-level1)', // 1-20%
      'var(--theme-heatmap-level2)', // 21-40%
      'var(--theme-heatmap-level3)', // 41-60%
      'var(--theme-heatmap-level4)', // 61-80%
      'var(--theme-heatmap-level5)'  // 81-100%
    ];

    const index = Math.min(Math.floor(ratio * (colors.length - 1)), colors.length - 1);
    return colors[index];
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
   * 销毁组件
   */
  destroy(): void {
    this.container.innerHTML = '';
  }
}
